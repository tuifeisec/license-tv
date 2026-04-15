package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

type DirectGrantDTO struct {
	CustomerID    *uint64 `json:"customer_id"`
	TVUsername    string  `json:"tv_username"`
	Contact       string  `json:"contact"`
	Remark        string  `json:"remark"`
	AgentID       *uint64 `json:"agent_id"`
	ScriptID      uint64  `json:"script_id" binding:"required"`
	PlanType      string  `json:"plan_type" binding:"required"`
	RequestedDays int     `json:"requested_days"`
}

type RenewDTO struct {
	PlanType      string `json:"plan_type" binding:"required"`
	RequestedDays int    `json:"requested_days"`
}

type SubscriptionService struct {
	db        *gorm.DB
	tv        TVProxy
	customers *CustomerService
	logger    *zap.Logger
}

func NewSubscriptionService(db *gorm.DB, tv TVProxy, customers *CustomerService, logger *zap.Logger) *SubscriptionService {
	return &SubscriptionService{db: db, tv: tv, customers: customers, logger: logger}
}

func (s *SubscriptionService) DirectGrant(operatorID uint64, dto DirectGrantDTO, scope ScriptScope) (*model.Subscription, error) {
	if !scope.Allows(dto.ScriptID) {
		return nil, errcode.ErrScriptNotPermitted
	}

	var script model.Script
	if err := s.db.Where("id = ? AND status = 1", dto.ScriptID).First(&script).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrTVScriptNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, tx.Error)
	}

	var customer *model.Customer
	if dto.CustomerID != nil {
		detail, err := s.customers.GetByID(*dto.CustomerID, nil, scope)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		customer = &detail.Customer
	} else {
		customerRecord, err := s.customers.FindOrCreatePendingByUsername(tx, dto.AgentID, dto.TVUsername, dto.Contact, dto.Remark, &operatorID)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		customer = customerRecord
	}

	validatedCustomer, err := s.customers.EnsureValidatedCustomer(tx, customer.ID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	customer = validatedCustomer

	var count int64
	if err := tx.Model(&model.Subscription{}).
		Where("customer_id = ? AND script_id = ? AND status = ?", customer.ID, dto.ScriptID, model.SubscriptionStatusActive).
		Count(&count).Error; err != nil {
		tx.Rollback()
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	if count > 0 {
		tx.Rollback()
		return nil, errcode.ErrSubscriptionExists
	}

	expiration, err := calculateExpiration(dto.PlanType, dto.RequestedDays, script.TrialDays, time.Now().UTC())
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	remoteSnapshot, err := snapshotTradingViewAccess(s.tv, script.PineID, customer.TVUsername)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := syncTradingViewAccess(s.tv, script.PineID, customer.TVUsername, expiration); err != nil {
		tx.Rollback()
		return nil, err
	}

	sub := model.Subscription{
		CustomerID: customer.ID,
		ScriptID:   script.ID,
		PlanType:   dto.PlanType,
		Status:     model.SubscriptionStatusActive,
		TVGranted:  true,
		StartedAt:  time.Now().UTC(),
		ExpiresAt:  expiration,
		GrantedBy:  &operatorID,
	}
	if err := tx.Create(&sub).Error; err != nil {
		tx.Rollback()
		return nil, s.compensateDirectGrantFailure(script.PineID, customer.TVUsername, remoteSnapshot, err)
	}
	if err := writeOperationLog(tx, operatorID, "direct_grant", "subscription", &sub.ID, sub, ""); err != nil {
		tx.Rollback()
		return nil, s.compensateDirectGrantFailure(script.PineID, customer.TVUsername, remoteSnapshot, err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, s.compensateDirectGrantFailure(script.PineID, customer.TVUsername, remoteSnapshot, err)
	}
	return s.GetByID(sub.ID, scope)
}

func (s *SubscriptionService) DirectRenew(operatorID, subID uint64, dto RenewDTO, scope ScriptScope) (*model.Subscription, error) {
	sub, err := s.GetByID(subID, scope)
	if err != nil {
		return nil, err
	}
	if sub.Status != model.SubscriptionStatusActive {
		return nil, errcode.ErrRequestStatus
	}

	var script model.Script
	if err := s.db.Where("id = ? AND status = 1", sub.ScriptID).First(&script).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrTVScriptNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	base := time.Now().UTC()
	if sub.ExpiresAt != nil && sub.ExpiresAt.After(base) {
		base = *sub.ExpiresAt
	}
	expiration, err := calculateExpiration(dto.PlanType, dto.RequestedDays, script.TrialDays, base)
	if err != nil {
		return nil, err
	}

	if expiration == nil {
		if err := s.tv.RemoveAccess(script.PineID, sub.Customer.TVUsername); err != nil {
			return nil, err
		}
		if err := s.tv.AddAccess(script.PineID, sub.Customer.TVUsername, nil); err != nil {
			return nil, err
		}
	} else if err := s.tv.ModifyExpiration(script.PineID, sub.Customer.TVUsername, *expiration); err != nil {
		return nil, err
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, tx.Error)
	}
	if err := tx.Model(&model.Subscription{}).Where("id = ?", sub.ID).Updates(map[string]any{
		"plan_type":  dto.PlanType,
		"expires_at": expiration,
		"granted_by": operatorID,
	}).Error; err != nil {
		tx.Rollback()
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	if err := writeOperationLog(tx, operatorID, "renew_subscription", "subscription", &sub.ID, map[string]any{
		"plan_type": dto.PlanType,
	}, ""); err != nil {
		tx.Rollback()
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return s.GetByID(sub.ID, scope)
}

func (s *SubscriptionService) Revoke(operatorID, subID uint64, reason string, scope ScriptScope) error {
	sub, err := s.GetByID(subID, scope)
	if err != nil {
		return err
	}
	if err := s.tv.RemoveAccess(sub.Script.PineID, sub.Customer.TVUsername); err != nil {
		return err
	}

	now := time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return errcode.Wrap(errcode.ErrInternal, tx.Error)
	}
	if err := tx.Model(&model.Subscription{}).Where("id = ?", sub.ID).Updates(map[string]any{
		"status":     model.SubscriptionStatusRevoked,
		"tv_granted": false,
		"revoked_at": now,
		"revoked_by": operatorID,
	}).Error; err != nil {
		tx.Rollback()
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	if err := writeOperationLog(tx, operatorID, "revoke_subscription", "subscription", &sub.ID, map[string]any{
		"reason": reason,
	}, ""); err != nil {
		tx.Rollback()
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	return tx.Commit().Error
}

func (s *SubscriptionService) List(filter SubscriptionFilter, scope ScriptScope) (*PageResult, error) {
	filter.Normalize()

	var total int64
	query := s.db.Model(&model.Subscription{}).Joins("JOIN customers ON customers.id = subscriptions.customer_id")
	query = scope.ApplyToQuery(query, "subscriptions.script_id")
	if filter.Status != "" {
		query = query.Where("subscriptions.status = ?", filter.Status)
	}
	if filter.ScriptID > 0 {
		query = query.Where("subscriptions.script_id = ?", filter.ScriptID)
	}
	if filter.AgentID > 0 {
		query = query.Where("customers.agent_id = ?", filter.AgentID)
	}
	if filter.CustomerKeyword != "" {
		query = query.Where("customers.tv_username LIKE ?", "%"+filter.CustomerKeyword+"%")
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var list []model.Subscription
	if err := query.Preload("Customer").Preload("Script").
		Order("subscriptions.id DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Find(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &PageResult{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *SubscriptionService) GetByID(id uint64, scope ScriptScope) (*model.Subscription, error) {
	var sub model.Subscription
	if err := s.db.Preload("Customer").Preload("Script").First(&sub, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrSubscriptionNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	if !scope.Allows(sub.ScriptID) {
		return nil, errcode.ErrScriptNotPermitted
	}
	return &sub, nil
}

func (s *SubscriptionService) RevokeExpired() (int, error) {
	var expired []model.Subscription
	if err := s.db.Preload("Customer").Preload("Script").
		Where("status = ? AND expires_at IS NOT NULL AND expires_at < ?", model.SubscriptionStatusActive, time.Now().UTC()).
		Find(&expired).Error; err != nil {
		return 0, errcode.Wrap(errcode.ErrInternal, err)
	}

	var (
		count           int
		failureMessages []string
	)

	for _, sub := range expired {
		if err := s.tv.RemoveAccess(sub.Script.PineID, sub.Customer.TVUsername); err != nil {
			msg := fmt.Sprintf("remove tv access failed for subscription=%d customer=%s script=%s: %v", sub.ID, sub.Customer.TVUsername, sub.Script.PineID, err)
			s.logger.Warn("revoke expired subscription failed", zap.String("stage", "remove_access"), zap.Uint64("subscription_id", sub.ID), zap.String("customer", sub.Customer.TVUsername), zap.String("pine_id", sub.Script.PineID), zap.Error(err))
			failureMessages = append(failureMessages, msg)
			continue
		}
		now := time.Now().UTC()
		if err := s.db.Model(&model.Subscription{}).Where("id = ?", sub.ID).Updates(map[string]any{
			"status":     model.SubscriptionStatusExpired,
			"tv_granted": false,
			"revoked_at": now,
		}).Error; err != nil {
			msg := fmt.Sprintf("update subscription status failed for subscription=%d: %v", sub.ID, err)
			s.logger.Warn("revoke expired subscription failed", zap.String("stage", "mark_expired"), zap.Uint64("subscription_id", sub.ID), zap.Error(err))
			failureMessages = append(failureMessages, msg)
			continue
		}
		count++
	}

	if len(failureMessages) > 0 {
		return count, errcode.Wrap(errcode.ErrInternal, fmt.Errorf("revoke expired completed with %d failures: %s", len(failureMessages), strings.Join(failureMessages, " | ")))
	}

	return count, nil
}

func (s *SubscriptionService) compensateDirectGrantFailure(pineID, username string, snapshot *TVAccessSnapshot, cause error) error {
	rollbackErr := restoreTradingViewAccess(s.tv, pineID, username, snapshot)
	if rollbackErr != nil {
		s.logger.Error("failed to compensate tradingview access after direct grant failure", zap.String("pine_id", pineID), zap.String("username", username), zap.Error(rollbackErr), zap.Error(cause))
		return errcode.Wrap(errcode.ErrInternal, fmt.Errorf("db write failed: %w; tradingview compensation failed: %v", cause, rollbackErr))
	}
	return errcode.Wrap(errcode.ErrInternal, cause)
}
