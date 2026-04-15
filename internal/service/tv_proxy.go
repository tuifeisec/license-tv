package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"tv-distribution/internal/config"
	"tv-distribution/internal/pkg/errcode"
)

var ErrTVAccessExists = errors.New("tradingview access already exists")

type TVAccountInfo map[string]any

type TVScriptDetail struct {
	UserID       uint64 `json:"userId"`
	ScriptName   string `json:"scriptName"`
	ScriptAccess string `json:"scriptAccess"`
	ScriptIDPart string `json:"scriptIdPart"`
	Version      string `json:"version"`
	Extra        struct {
		Kind             string `json:"kind"`
		ShortDescription string `json:"shortDescription"`
	} `json:"extra"`
}

type TVUserHint struct {
	ID       uint64 `json:"id"`
	Username string `json:"username"`
	Inactive bool   `json:"inactive"`
}

type TVUserAccess struct {
	ID         uint64     `json:"id"`
	Username   string     `json:"username"`
	Expiration *time.Time `json:"expiration"`
	Created    time.Time  `json:"created"`
}

type ListUsersOptions struct {
	Limit    int
	OrderBy  string
	Username string
	Cursor   string
}

type TVListUsersResult struct {
	Results []TVUserAccess `json:"results"`
	Next    string         `json:"next"`
	Prev    string         `json:"prev"`
}

type TVSessionStatus struct {
	Configured        bool   `json:"configured"`
	SessionIDMasked   string `json:"sessionid_masked"`
	SessionSignMasked string `json:"sessionid_sign_masked"`
}

type TVProxy interface {
	ValidateSession() (*TVAccountInfo, error)
	ListScripts() ([]string, error)
	GetPublishedScriptsDetail() ([]TVScriptDetail, error)
	ValidateUsername(keyword string) ([]TVUserHint, error)
	ListUsers(pineID string, opts ListUsersOptions) (*TVListUsersResult, error)
	ListAllUsers(pineID string) ([]TVUserAccess, error)
	AddAccess(pineID, username string, expiration *time.Time) error
	RemoveAccess(pineID, username string) error
	ModifyExpiration(pineID, username string, expiration time.Time) error
	UpdateCookies(sessionID, sessionIDSign string)
	SessionStatus() TVSessionStatus
}

type TradingViewProxy struct {
	client *http.Client
	cfg    *config.TradingViewConfig
	mu     sync.RWMutex
}

func NewTradingViewProxy(cfg *config.TradingViewConfig) *TradingViewProxy {
	return &TradingViewProxy{
		cfg: cfg,
		client: &http.Client{
			Timeout: cfg.Timeout(),
		},
	}
}

func (p *TradingViewProxy) UpdateCookies(sessionID, sessionIDSign string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cfg.SessionID = sessionID
	p.cfg.SessionIDSign = sessionIDSign
}

func (p *TradingViewProxy) SessionStatus() TVSessionStatus {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return TVSessionStatus{
		Configured:        p.cfg.SessionID != "" && p.cfg.SessionIDSign != "",
		SessionIDMasked:   maskValue(p.cfg.SessionID),
		SessionSignMasked: maskValue(p.cfg.SessionIDSign),
	}
}

func (p *TradingViewProxy) ValidateSession() (*TVAccountInfo, error) {
	resp, body, err := p.doRequest(http.MethodGet, p.cfg.BaseURL+"/tvcoins/details/", nil, nil, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result TVAccountInfo
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, errcode.Wrap(errcode.ErrTVAccessFailed, err)
	}
	return &result, nil
}

func (p *TradingViewProxy) ListScripts() ([]string, error) {
	resp, body, err := p.doRequest(http.MethodGet, p.cfg.BaseURL+"/pine_perm/list_scripts/", nil, nil, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result []string
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, errcode.Wrap(errcode.ErrTVAccessFailed, err)
	}
	return result, nil
}

func (p *TradingViewProxy) GetPublishedScriptsDetail() ([]TVScriptDetail, error) {
	resp, body, err := p.doRequest(http.MethodGet, p.cfg.PineFacadeURL+"/list/?filter=published", nil, nil, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result []TVScriptDetail
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, errcode.Wrap(errcode.ErrTVAccessFailed, err)
	}
	return result, nil
}

func (p *TradingViewProxy) ValidateUsername(keyword string) ([]TVUserHint, error) {
	query := url.Values{}
	query.Set("s", keyword)
	resp, body, err := p.doRequest(http.MethodGet, p.cfg.BaseURL+"/username_hint/", query, nil, true)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result []TVUserHint
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, errcode.Wrap(errcode.ErrTVAccessFailed, err)
	}
	return result, nil
}

func (p *TradingViewProxy) ListUsers(pineID string, opts ListUsersOptions) (*TVListUsersResult, error) {
	form := url.Values{}
	form.Set("pine_id", pineID)
	if opts.Username != "" {
		form.Set("username", opts.Username)
	}

	targetURL := p.cfg.BaseURL + "/pine_perm/list_users/"
	if opts.Cursor != "" {
		targetURL = p.cfg.BaseURL + opts.Cursor
	} else {
		query := url.Values{}
		limit := opts.Limit
		if limit <= 0 {
			limit = 30
		}
		query.Set("limit", fmt.Sprintf("%d", limit))
		orderBy := opts.OrderBy
		if orderBy == "" {
			orderBy = "-created"
		}
		query.Set("order_by", orderBy)
		targetURL += "?" + query.Encode()
	}

	resp, body, err := p.doRequest(http.MethodPost, targetURL, nil, form, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result TVListUsersResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, errcode.Wrap(errcode.ErrTVAccessFailed, err)
	}
	return &result, nil
}

func (p *TradingViewProxy) ListAllUsers(pineID string) ([]TVUserAccess, error) {
	const maxPages = 100

	var (
		all        []TVUserAccess
		cursor     string
		seenCursor = map[string]struct{}{}
	)

	if cursor != "" {
		seenCursor[cursor] = struct{}{}
	}

	for {
		result, err := p.ListUsers(pineID, ListUsersOptions{
			Limit:   30,
			OrderBy: "-created",
			Cursor:  cursor,
		})
		if err != nil {
			return nil, err
		}
		all = append(all, result.Results...)
		if result.Next == "" {
			break
		}

		if result.Next == cursor {
			return nil, errcode.Wrap(errcode.ErrTVAccessFailed, fmt.Errorf("list users cursor repeated for pine_id=%s", pineID))
		}
		if _, ok := seenCursor[result.Next]; ok {
			return nil, errcode.Wrap(errcode.ErrTVAccessFailed, fmt.Errorf("list users cursor loop detected for pine_id=%s", pineID))
		}
		if len(seenCursor) >= maxPages {
			return nil, errcode.Wrap(errcode.ErrTVAccessFailed, fmt.Errorf("list users exceeded max pages for pine_id=%s", pineID))
		}

		seenCursor[result.Next] = struct{}{}
		cursor = result.Next
	}
	return all, nil
}

func (p *TradingViewProxy) AddAccess(pineID, username string, expiration *time.Time) error {
	form := url.Values{}
	form.Set("pine_id", pineID)
	form.Set("username_recip", username)
	if expiration != nil {
		form.Set("expiration", expiration.UTC().Format("2006-01-02T15:04:05.000Z"))
	}

	resp, body, err := p.doRequest(http.MethodPost, p.cfg.BaseURL+"/pine_perm/add/", nil, form, false)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated {
		return nil
	}

	var result map[string]any
	_ = json.Unmarshal(body, &result)
	if result["status"] == "exists" {
		return ErrTVAccessExists
	}
	return nil
}

func (p *TradingViewProxy) RemoveAccess(pineID, username string) error {
	form := url.Values{}
	form.Set("pine_id", pineID)
	form.Set("username_recip", username)
	_, _, err := p.doRequest(http.MethodPost, p.cfg.BaseURL+"/pine_perm/remove/", nil, form, false)
	return err
}

func (p *TradingViewProxy) ModifyExpiration(pineID, username string, expiration time.Time) error {
	form := url.Values{}
	form.Set("pine_id", pineID)
	form.Set("username_recip", username)
	form.Set("expiration", expiration.UTC().Format("2006-01-02T15:04:05.000Z"))
	_, _, err := p.doRequest(http.MethodPost, p.cfg.BaseURL+"/pine_perm/modify_user_expiration/", nil, form, false)
	return err
}

func (p *TradingViewProxy) doRequest(method, targetURL string, query url.Values, form url.Values, allowAnonymous bool) (*http.Response, []byte, error) {
	if query != nil && len(query) > 0 {
		sep := "?"
		if strings.Contains(targetURL, "?") {
			sep = "&"
		}
		targetURL += sep + query.Encode()
	}

	encodedForm := ""
	if form != nil {
		encodedForm = form.Encode()
	}

	maxAttempts := p.cfg.MaxRetries + 1
	if maxAttempts < 1 {
		maxAttempts = 1
	}

	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		var bodyReader io.Reader
		if encodedForm != "" {
			bodyReader = bytes.NewBufferString(encodedForm)
		}
		req, err := http.NewRequest(method, targetURL, bodyReader)
		if err != nil {
			return nil, nil, errcode.Wrap(errcode.ErrTVAccessFailed, err)
		}

		if encodedForm != "" {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			req.Header.Set("Origin", p.cfg.BaseURL)
		}
		if !allowAnonymous {
			req.Header.Set("Cookie", p.cookieHeader())
		}

		resp, err := p.client.Do(req)
		if err != nil {
			lastErr = err
			if attempt < maxAttempts && isRetryableError(err) {
				time.Sleep(time.Duration(attempt) * 300 * time.Millisecond)
				continue
			}
			return nil, nil, errcode.Wrap(errcode.ErrTVAccessFailed, err)
		}

		body, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			resp.Body.Close()
			return nil, nil, errcode.Wrap(errcode.ErrTVAccessFailed, readErr)
		}
		resp.Body = io.NopCloser(bytes.NewBuffer(body))

		if resp.StatusCode >= 500 && attempt < maxAttempts {
			resp.Body.Close()
			time.Sleep(time.Duration(attempt) * 300 * time.Millisecond)
			continue
		}
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			resp.Body.Close()
			return nil, nil, errcode.ErrTVInvalidCookie
		}
		if resp.StatusCode == http.StatusUnprocessableEntity {
			resp.Body.Close()
			if bytes.Contains(body, []byte("username_recip_not_found")) {
				return nil, nil, errcode.ErrTVUsernameNotFound
			}
			if bytes.Contains(body, []byte("\"pine_id\"")) {
				return nil, nil, errcode.ErrTVScriptNotFound
			}
			return nil, nil, errcode.Wrap(errcode.ErrTVAccessFailed, fmt.Errorf(string(body)))
		}
		if resp.StatusCode >= 400 {
			resp.Body.Close()
			return nil, nil, errcode.Wrap(errcode.ErrTVAccessFailed, fmt.Errorf("status=%d body=%s", resp.StatusCode, string(body)))
		}
		return resp, body, nil
	}

	return nil, nil, errcode.Wrap(errcode.ErrTVAccessFailed, lastErr)
}

func (p *TradingViewProxy) cookieHeader() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return "sessionid=" + p.cfg.SessionID + "; sessionid_sign=" + p.cfg.SessionIDSign
}

func maskValue(v string) string {
	if len(v) <= 8 {
		return v
	}
	return v[:4] + strings.Repeat("*", len(v)-8) + v[len(v)-4:]
}

func isRetryableError(err error) bool {
	var netErr net.Error
	return errors.As(err, &netErr)
}
