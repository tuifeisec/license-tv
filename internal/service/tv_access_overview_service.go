package service

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

const (
	TVAccessStatusActive    = "active"
	TVAccessStatusExpiring  = "expiring"
	TVAccessStatusExpired   = "expired"
	TVAccessStatusPermanent = "permanent"

	TVReconcileMatchedActive   = "matched_active"
	TVReconcileNoCustomer      = "no_customer"
	TVReconcileNoSubscription  = "no_subscription"
	TVReconcileDBInactive      = "db_inactive"
	TVReconcileGrantFlagMissed = "grant_flag_mismatch"
)

type TVAccessOverviewFilter struct {
	ListFilter
	ScriptID        uint64 `form:"script_id"`
	AccessStatus    string `form:"access_status"`
	ReconcileStatus string `form:"reconcile_status"`
}

type TVAccessOverviewRow struct {
	ScriptID              uint64     `json:"script_id"`
	ScriptName            string     `json:"script_name"`
	TVUserID              uint64     `json:"tv_user_id"`
	Username              string     `json:"username"`
	TVExpiration          *time.Time `json:"tv_expiration"`
	TVCreated             time.Time  `json:"tv_created"`
	AccessStatus          string     `json:"access_status"`
	CustomerID            *uint64    `json:"customer_id,omitempty"`
	CustomerContact       string     `json:"customer_contact,omitempty"`
	AgentID               *uint64    `json:"agent_id,omitempty"`
	SubscriptionID        *uint64    `json:"subscription_id,omitempty"`
	SubscriptionStatus    string     `json:"subscription_status,omitempty"`
	SubscriptionExpiresAt *time.Time `json:"subscription_expires_at,omitempty"`
	SubscriptionTVGranted *bool      `json:"subscription_tv_granted,omitempty"`
	ReconcileStatus       string     `json:"reconcile_status"`
}

type TVAccessOverviewError struct {
	ScriptID   uint64 `json:"script_id"`
	ScriptName string `json:"script_name"`
	Error      string `json:"error"`
}

type TVAccessOverviewSummary struct {
	TotalRecords           int `json:"total_records"`
	UniqueUserCount        int `json:"unique_user_count"`
	ScriptCount            int `json:"script_count"`
	ActiveCount            int `json:"active_count"`
	ExpiringCount          int `json:"expiring_count"`
	ExpiredCount           int `json:"expired_count"`
	PermanentCount         int `json:"permanent_count"`
	MatchedActiveCount     int `json:"matched_active_count"`
	NoCustomerCount        int `json:"no_customer_count"`
	NoSubscriptionCount    int `json:"no_subscription_count"`
	DBInactiveCount        int `json:"db_inactive_count"`
	GrantFlagMismatchCount int `json:"grant_flag_mismatch_count"`
	ErrorScriptCount       int `json:"error_script_count"`
}

type TVAccessOverviewResult struct {
	List         []TVAccessOverviewRow   `json:"list"`
	Total        int64                   `json:"total"`
	Page         int                     `json:"page"`
	PageSize     int                     `json:"page_size"`
	Summary      TVAccessOverviewSummary `json:"summary"`
	ErrorScripts []TVAccessOverviewError `json:"error_scripts"`
}

type TVAccessOverviewService struct {
	db *gorm.DB
}

func NewTVAccessOverviewService(db *gorm.DB) *TVAccessOverviewService {
	return &TVAccessOverviewService{db: db}
}

func (s *TVAccessOverviewService) List(filter TVAccessOverviewFilter) (*TVAccessOverviewResult, error) {
	filter.Normalize()

	var scripts []model.Script
	query := s.db.Model(&model.Script{})
	if filter.ScriptID > 0 {
		query = query.Where("id = ?", filter.ScriptID)
	}
	if err := query.Order("id DESC").Find(&scripts).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var rows []TVAccessOverviewRow

	if len(scripts) == 0 {
		return &TVAccessOverviewResult{
			List:         []TVAccessOverviewRow{},
			Total:        0,
			Page:         filter.Page,
			PageSize:     filter.PageSize,
			Summary:      TVAccessOverviewSummary{},
			ErrorScripts: []TVAccessOverviewError{},
		}, nil
	}

	customers, err := s.loadCustomers()
	if err != nil {
		return nil, err
	}

	subscriptions, err := s.loadSubscriptions(scripts)
	if err != nil {
		return nil, err
	}

	scriptMap := make(map[uint64]model.Script, len(scripts))
	for _, script := range scripts {
		scriptMap[script.ID] = script
	}

	accesses, err := s.loadActiveTVAccesses(filter.ScriptID)
	if err != nil {
		return nil, err
	}

	for _, access := range accesses {
		script, ok := scriptMap[access.ScriptID]
		if !ok {
			continue
		}

		row := TVAccessOverviewRow{
			ScriptID:     script.ID,
			ScriptName:   script.Name,
			TVUserID:     access.TVUserID,
			Username:     access.Username,
			TVExpiration: access.Expiration,
			TVCreated:    access.TVCreatedAt,
			AccessStatus: classifyTVAccessStatus(access.Expiration),
		}

		customer := customers[strings.ToLower(access.Username)]
		if customer == nil {
			row.ReconcileStatus = TVReconcileNoCustomer
			rows = append(rows, row)
			continue
		}

		row.CustomerID = &customer.ID
		row.CustomerContact = customer.Contact
		row.AgentID = customer.AgentID

		subKey := tvAccessSubscriptionKey(customer.ID, script.ID)
		subscription, ok := subscriptions[subKey]
		if !ok {
			row.ReconcileStatus = TVReconcileNoSubscription
			rows = append(rows, row)
			continue
		}

		row.SubscriptionID = &subscription.ID
		row.SubscriptionStatus = subscription.Status
		row.SubscriptionExpiresAt = subscription.ExpiresAt
		row.SubscriptionTVGranted = &subscription.TVGranted
		row.ReconcileStatus = classifyTVReconcileStatus(subscription)
		rows = append(rows, row)
	}

	rows = filterTVAccessRows(rows, filter)
	sortTVAccessRows(rows)

	total := int64(len(rows))
	start := (filter.Page - 1) * filter.PageSize
	if start > len(rows) {
		start = len(rows)
	}
	end := start + filter.PageSize
	if end > len(rows) {
		end = len(rows)
	}

	return &TVAccessOverviewResult{
		List:         rows[start:end],
		Total:        total,
		Page:         filter.Page,
		PageSize:     filter.PageSize,
		Summary:      summarizeTVAccessRows(rows, len(scripts), 0),
		ErrorScripts: []TVAccessOverviewError{},
	}, nil
}

func (s *TVAccessOverviewService) loadActiveTVAccesses(scriptID uint64) ([]model.TVAccess, error) {
	var list []model.TVAccess
	query := s.db.Where("removed_at IS NULL")
	if scriptID > 0 {
		query = query.Where("script_id = ?", scriptID)
	}
	if err := query.Order("script_id ASC, username ASC").Find(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return list, nil
}

func (s *TVAccessOverviewService) loadCustomers() (map[string]*model.Customer, error) {
	var customers []model.Customer
	if err := s.db.Find(&customers).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	result := make(map[string]*model.Customer, len(customers))
	for i := range customers {
		customer := customers[i]
		result[strings.ToLower(customer.TVUsername)] = &customer
	}
	return result, nil
}

func (s *TVAccessOverviewService) loadSubscriptions(scripts []model.Script) (map[string]model.Subscription, error) {
	scriptIDs := make([]uint64, 0, len(scripts))
	for _, script := range scripts {
		scriptIDs = append(scriptIDs, script.ID)
	}

	var subscriptions []model.Subscription
	if err := s.db.Where("script_id IN ?", scriptIDs).Order("id DESC").Find(&subscriptions).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	result := make(map[string]model.Subscription, len(subscriptions))
	for _, subscription := range subscriptions {
		key := tvAccessSubscriptionKey(subscription.CustomerID, subscription.ScriptID)
		current, exists := result[key]
		if !exists || shouldPreferSubscription(subscription, current) {
			result[key] = subscription
		}
	}
	return result, nil
}

func classifyTVAccessStatus(expiration *time.Time) string {
	if expiration == nil {
		return TVAccessStatusPermanent
	}

	diff := expiration.Sub(time.Now().UTC())
	if diff < 0 {
		return TVAccessStatusExpired
	}
	if diff <= 7*24*time.Hour {
		return TVAccessStatusExpiring
	}
	return TVAccessStatusActive
}

func classifyTVReconcileStatus(subscription model.Subscription) string {
	if subscription.Status != model.SubscriptionStatusActive {
		return TVReconcileDBInactive
	}
	if !subscription.TVGranted {
		return TVReconcileGrantFlagMissed
	}
	return TVReconcileMatchedActive
}

func filterTVAccessRows(rows []TVAccessOverviewRow, filter TVAccessOverviewFilter) []TVAccessOverviewRow {
	if filter.Keyword == "" && filter.AccessStatus == "" && filter.ReconcileStatus == "" {
		return rows
	}

	keyword := strings.ToLower(strings.TrimSpace(filter.Keyword))
	filtered := make([]TVAccessOverviewRow, 0, len(rows))
	for _, row := range rows {
		if keyword != "" {
			if !strings.Contains(strings.ToLower(row.Username), keyword) &&
				!strings.Contains(strings.ToLower(row.ScriptName), keyword) {
				continue
			}
		}
		if filter.AccessStatus != "" && row.AccessStatus != filter.AccessStatus {
			continue
		}
		if filter.ReconcileStatus != "" && row.ReconcileStatus != filter.ReconcileStatus {
			continue
		}
		filtered = append(filtered, row)
	}
	return filtered
}

func sortTVAccessRows(rows []TVAccessOverviewRow) {
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Username != rows[j].Username {
			return rows[i].Username < rows[j].Username
		}
		if rows[i].ScriptName != rows[j].ScriptName {
			return rows[i].ScriptName < rows[j].ScriptName
		}
		return rows[i].TVUserID < rows[j].TVUserID
	})
}

func summarizeTVAccessRows(rows []TVAccessOverviewRow, scriptCount, errorScriptCount int) TVAccessOverviewSummary {
	summary := TVAccessOverviewSummary{
		TotalRecords:     len(rows),
		ScriptCount:      scriptCount,
		ErrorScriptCount: errorScriptCount,
	}

	userSet := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		userSet[strings.ToLower(row.Username)] = struct{}{}

		switch row.AccessStatus {
		case TVAccessStatusActive:
			summary.ActiveCount++
		case TVAccessStatusExpiring:
			summary.ExpiringCount++
		case TVAccessStatusExpired:
			summary.ExpiredCount++
		case TVAccessStatusPermanent:
			summary.PermanentCount++
		}

		switch row.ReconcileStatus {
		case TVReconcileMatchedActive:
			summary.MatchedActiveCount++
		case TVReconcileNoCustomer:
			summary.NoCustomerCount++
		case TVReconcileNoSubscription:
			summary.NoSubscriptionCount++
		case TVReconcileDBInactive:
			summary.DBInactiveCount++
		case TVReconcileGrantFlagMissed:
			summary.GrantFlagMismatchCount++
		}
	}
	summary.UniqueUserCount = len(userSet)
	return summary
}

func tvAccessSubscriptionKey(customerID, scriptID uint64) string {
	return fmt.Sprintf("%d:%d", customerID, scriptID)
}

func shouldPreferSubscription(candidate, current model.Subscription) bool {
	if candidate.Status == model.SubscriptionStatusActive && current.Status != model.SubscriptionStatusActive {
		return true
	}
	if candidate.Status != model.SubscriptionStatusActive && current.Status == model.SubscriptionStatusActive {
		return false
	}
	return candidate.ID > current.ID
}
