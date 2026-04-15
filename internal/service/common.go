package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

type PageResult struct {
	List     any   `json:"list"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
}

type ListFilter struct {
	Page     int    `form:"page"`
	PageSize int    `form:"page_size"`
	Keyword  string `form:"keyword"`
}

func (f *ListFilter) Normalize() {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.PageSize <= 0 {
		f.PageSize = 20
	}
	if f.PageSize > 100 {
		f.PageSize = 100
	}
}

type AgentListFilter struct {
	ListFilter
	Status      string `form:"status"`
	Performance string `form:"performance"`
	SortBy      string `form:"sort_by"`
	SortOrder   string `form:"sort_order"`
}

func (f *AgentListFilter) Normalize() {
	f.ListFilter.Normalize()
	f.Status = strings.TrimSpace(strings.ToLower(f.Status))
	f.Performance = strings.TrimSpace(strings.ToLower(f.Performance))
	f.SortBy = strings.TrimSpace(strings.ToLower(f.SortBy))
	f.SortOrder = strings.TrimSpace(strings.ToLower(f.SortOrder))
	if f.SortBy == "" {
		f.SortBy = "created_at"
	}
	if f.SortOrder == "" {
		f.SortOrder = "desc"
	}
}

type SubAdminListFilter struct {
	ListFilter
	Status string `form:"status"`
}

func (f *SubAdminListFilter) Normalize() {
	f.ListFilter.Normalize()
	f.Status = strings.TrimSpace(strings.ToLower(f.Status))
}

type RequestFilter struct {
	ListFilter
	Status   string `form:"status"`
	ScriptID uint64 `form:"script_id"`
}

type SubscriptionFilter struct {
	ListFilter
	Status          string `form:"status"`
	ScriptID        uint64 `form:"script_id"`
	AgentID         uint64 `form:"agent_id"`
	CustomerKeyword string `form:"customer_keyword"`
}

type CustomerFilter struct {
	ListFilter
	AgentID            *uint64
	SubscriptionStatus string `form:"subscription_status"`
}

func (f *CustomerFilter) Normalize() {
	f.ListFilter.Normalize()
	f.SubscriptionStatus = strings.TrimSpace(strings.ToLower(f.SubscriptionStatus))
}

type BatchResult struct {
	SuccessIDs []uint64          `json:"success_ids"`
	Failed     map[uint64]string `json:"failed"`
}

type TVAccessSnapshot struct {
	Exists     bool
	Expiration *time.Time
}

func newRequestNo() string {
	buf := make([]byte, 5)
	_, _ = rand.Read(buf)
	return "REQ" + time.Now().UTC().Format("20060102150405") + strings.ToUpper(hex.EncodeToString(buf))
}

func calculateExpiration(planType string, requestedDays, trialDays int, base time.Time) (*time.Time, error) {
	if requestedDays > 0 {
		exp := base.AddDate(0, 0, requestedDays)
		return &exp, nil
	}

	var expiration time.Time
	switch planType {
	case model.PlanMonthly:
		expiration = base.AddDate(0, 1, 0)
	case model.PlanQuarterly:
		expiration = base.AddDate(0, 3, 0)
	case model.PlanYearly:
		expiration = base.AddDate(1, 0, 0)
	case model.PlanTrial:
		days := trialDays
		if days <= 0 {
			days = 7
		}
		expiration = base.AddDate(0, 0, days)
	case model.PlanLifetime:
		return nil, nil
	default:
		return nil, errcode.ErrValidation
	}

	return &expiration, nil
}

func syncTradingViewAccess(tv TVProxy, pineID, username string, expiration *time.Time) error {
	err := tv.AddAccess(pineID, username, expiration)
	if err == nil {
		return nil
	}

	if errors.Is(err, ErrTVAccessExists) {
		if expiration == nil {
			if removeErr := tv.RemoveAccess(pineID, username); removeErr != nil {
				return removeErr
			}
			return tv.AddAccess(pineID, username, nil)
		}
		return tv.ModifyExpiration(pineID, username, *expiration)
	}

	return err
}

func snapshotTradingViewAccess(tv TVProxy, pineID, username string) (*TVAccessSnapshot, error) {
	result, err := tv.ListUsers(pineID, ListUsersOptions{
		Limit:    1,
		OrderBy:  "-created",
		Username: username,
	})
	if err != nil {
		return nil, err
	}

	snapshot := &TVAccessSnapshot{}
	for _, item := range result.Results {
		if strings.EqualFold(item.Username, username) {
			snapshot.Exists = true
			snapshot.Expiration = item.Expiration
			return snapshot, nil
		}
	}
	return snapshot, nil
}

func restoreTradingViewAccess(tv TVProxy, pineID, username string, snapshot *TVAccessSnapshot) error {
	if snapshot == nil || !snapshot.Exists {
		return tv.RemoveAccess(pineID, username)
	}
	return syncTradingViewAccess(tv, pineID, username, snapshot.Expiration)
}

func writeOperationLog(tx *gorm.DB, operatorID uint64, action, targetType string, targetID *uint64, detail any, ip string) error {
	payload, err := json.Marshal(detail)
	if err != nil {
		return err
	}
	log := model.OperationLog{
		OperatorID: operatorID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     payload,
		IP:         ip,
	}
	return tx.Create(&log).Error
}
