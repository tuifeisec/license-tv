package service

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

type AccessAuditEntry struct {
	ScriptID      uint64   `json:"script_id"`
	ScriptName    string   `json:"script_name"`
	TVUserCount   int      `json:"tv_user_count"`
	DBActiveCount int      `json:"db_active_count"`
	MissingOnTV   []string `json:"missing_on_tv"`
	ExtraOnTV     []string `json:"extra_on_tv"`
	Error         string   `json:"error,omitempty"`
}

type AccessAuditResult struct {
	RanAt         time.Time          `json:"ran_at"`
	ScriptCount   int                `json:"script_count"`
	MismatchCount int                `json:"mismatch_count"`
	ErrorCount    int                `json:"error_count"`
	Entries       []AccessAuditEntry `json:"entries"`
}

type AccessAuditService struct {
	db *gorm.DB
}

func NewAccessAuditService(db *gorm.DB) *AccessAuditService {
	return &AccessAuditService{db: db}
}

func (s *AccessAuditService) Run(operatorID uint64, ip string) (*AccessAuditResult, error) {
	var scripts []model.Script
	if err := s.db.Where("status = 1").Find(&scripts).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	result := &AccessAuditResult{
		RanAt:       time.Now().UTC(),
		ScriptCount: len(scripts),
		Entries:     make([]AccessAuditEntry, 0, len(scripts)),
	}

	for _, script := range scripts {
		entry := AccessAuditEntry{
			ScriptID:   script.ID,
			ScriptName: script.Name,
		}

		var tvUsers []model.TVAccess
		if err := s.db.
			Where("script_id = ? AND removed_at IS NULL", script.ID).
			Find(&tvUsers).Error; err != nil {
			return nil, errcode.Wrap(errcode.ErrInternal, err)
		}

		var subs []model.Subscription
		if err := s.db.Preload("Customer").
			Where("script_id = ? AND status = ?", script.ID, model.SubscriptionStatusActive).
			Find(&subs).Error; err != nil {
			return nil, errcode.Wrap(errcode.ErrInternal, err)
		}

		entry.TVUserCount = len(tvUsers)
		entry.DBActiveCount = len(subs)

		tvSet := make(map[string]struct{}, len(tvUsers))
		for _, item := range tvUsers {
			tvSet[strings.ToLower(item.Username)] = struct{}{}
		}

		dbSet := make(map[string]struct{}, len(subs))
		for _, sub := range subs {
			dbSet[strings.ToLower(sub.Customer.TVUsername)] = struct{}{}
		}

		for username := range dbSet {
			if _, ok := tvSet[username]; !ok {
				entry.MissingOnTV = append(entry.MissingOnTV, username)
			}
		}
		for username := range tvSet {
			if _, ok := dbSet[username]; !ok {
				entry.ExtraOnTV = append(entry.ExtraOnTV, username)
			}
		}

		if len(entry.MissingOnTV) > 0 || len(entry.ExtraOnTV) > 0 {
			result.MismatchCount++
		}

		result.Entries = append(result.Entries, entry)
	}

	if err := writeOperationLog(s.db, operatorID, "access_audit", "system", nil, result, ip); err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	return result, nil
}
