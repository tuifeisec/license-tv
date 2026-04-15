package service

import (
	"errors"
	"fmt"
	"path"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

type SubmitRequestDTO struct {
	CustomerID    *uint64 `json:"customer_id"`
	TVUsername    string  `json:"tv_username"`
	Contact       string  `json:"contact"`
	Remark        string  `json:"remark"`
	ScriptID      uint64  `json:"script_id" binding:"required"`
	Action        string  `json:"action" binding:"required"`
	PlanType      string  `json:"plan_type" binding:"required"`
	RequestedDays int     `json:"requested_days"`
	Amount        float64 `json:"amount"`
	PaymentProof  string  `json:"payment_proof" binding:"required"`
}

type RejectRequestDTO struct {
	Reason string `json:"reason" binding:"required"`
}

type BatchApproveDTO struct {
	RequestIDs []uint64 `json:"request_ids" binding:"required"`
}

type ReviewService struct {
	db        *gorm.DB
	tv        TVProxy
	customers *CustomerService
	logger    *zap.Logger
}

func NewReviewService(db *gorm.DB, tv TVProxy, customers *CustomerService, logger *zap.Logger) *ReviewService {
	return &ReviewService{db: db, tv: tv, customers: customers, logger: logger}
}

func (s *ReviewService) SubmitRequest(agentID uint64, dto SubmitRequestDTO) (*model.AccessRequest, error) {
	paymentProofPath, err := normalizePaymentProofPath(dto.PaymentProof)
	if err != nil {
		return nil, err
	}

	var script model.Script
	if err := s.db.Where("id = ? AND status = 1", dto.ScriptID).First(&script).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrTVScriptNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var customerID uint64
	if dto.CustomerID != nil {
		detail, err := s.customers.GetByID(*dto.CustomerID, &agentID, Unrestricted())
		if err != nil {
			return nil, err
		}
		customerID = detail.Customer.ID
	} else {
		tx := s.db.Begin()
		if tx.Error != nil {
			return nil, errcode.Wrap(errcode.ErrInternal, tx.Error)
		}
		customer, err := s.customers.FindOrCreatePendingByUsername(tx, &agentID, dto.TVUsername, dto.Contact, dto.Remark, &agentID)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		customerID = customer.ID
		if err := tx.Commit().Error; err != nil {
			return nil, errcode.Wrap(errcode.ErrInternal, err)
		}
	}

	if err := s.ensureNoPendingDuplicate(s.db, agentID, customerID, dto.ScriptID); err != nil {
		return nil, err
	}

	req := model.AccessRequest{
		RequestNo:     newRequestNo(),
		AgentID:       agentID,
		CustomerID:    customerID,
		ScriptID:      dto.ScriptID,
		Action:        dto.Action,
		PlanType:      dto.PlanType,
		RequestedDays: dto.RequestedDays,
		Amount:        dto.Amount,
		PaymentProof:  paymentProofPath,
		Status:        model.RequestStatusPending,
		Remark:        dto.Remark,
	}
	if err := s.db.Create(&req).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &req, nil
}

func normalizePaymentProofPath(input string) (string, error) {
	value := strings.TrimSpace(input)
	if value == "" {
		return "", errcode.ErrValidation
	}

	if index := strings.Index(value, "/uploads/payment-proofs/"); index >= 0 {
		value = value[index:]
	}

	if !strings.HasPrefix(value, "/uploads/payment-proofs/") {
		return "", errcode.ErrPaymentProofInvalid
	}

	cleaned := path.Clean(value)
	if !strings.HasPrefix(cleaned, "/uploads/payment-proofs/") {
		return "", errcode.ErrPaymentProofInvalid
	}

	lower := strings.ToLower(cleaned)
	if !(strings.HasSuffix(lower, ".png") || strings.HasSuffix(lower, ".jpg") || strings.HasSuffix(lower, ".jpeg") || strings.HasSuffix(lower, ".webp")) {
		return "", errcode.ErrPaymentProofInvalid
	}

	return cleaned, nil
}

func (s *ReviewService) CancelRequest(agentID, requestID uint64) error {
	var req model.AccessRequest
	if err := s.db.Where("id = ? AND agent_id = ?", requestID, agentID).First(&req).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errcode.ErrRequestNotFound
		}
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	if req.Status != model.RequestStatusPending {
		return errcode.ErrRequestStatus
	}
	return s.db.Model(&req).Updates(map[string]any{
		"status":        model.RequestStatusCancelled,
		"reject_reason": "cancelled by agent",
	}).Error
}

func (s *ReviewService) ListMyRequests(agentID uint64, filter RequestFilter) (*PageResult, error) {
	filter.Normalize()

	var total int64
	query := s.db.Model(&model.AccessRequest{}).Where("agent_id = ?", agentID)
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.ScriptID > 0 {
		query = query.Where("script_id = ?", filter.ScriptID)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var list []model.AccessRequest
	if err := query.Preload("Customer").Preload("Script").
		Order("id DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Find(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &PageResult{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *ReviewService) ListPendingRequests(filter RequestFilter, scope ScriptScope) (*PageResult, error) {
	filter.Normalize()

	var total int64
	query := s.db.Model(&model.AccessRequest{})
	query = scope.ApplyToQuery(query, "script_id")
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.ScriptID > 0 {
		query = query.Where("script_id = ?", filter.ScriptID)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var list []model.AccessRequest
	if err := query.Preload("Customer").Preload("Script").Preload("Agent").
		Order("id DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Find(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &PageResult{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *ReviewService) GetByID(requestID uint64, agentID *uint64, scope ScriptScope) (*model.AccessRequest, error) {
	var req model.AccessRequest
	query := s.db.Preload("Customer").Preload("Script").Preload("Agent").Where("id = ?", requestID)
	if agentID != nil {
		query = query.Where("agent_id = ?", *agentID)
	}
	query = scope.ApplyToQuery(query, "script_id")
	if err := query.First(&req).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrRequestNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &req, nil
}

func (s *ReviewService) ApproveRequest(reviewerID, requestID uint64, scope ScriptScope) error {
	req, err := s.GetByID(requestID, nil, Unrestricted())
	if err != nil {
		return err
	}
	if !scope.Allows(req.ScriptID) {
		return errcode.ErrScriptNotPermitted
	}
	if req.Status != model.RequestStatusPending {
		return errcode.ErrRequestStatus
	}

	var script model.Script
	if err := s.db.Where("id = ? AND status = 1", req.ScriptID).First(&script).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errcode.ErrTVScriptNotFound
		}
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	var activeSub model.Subscription
	hasActiveSub := false
	err = s.db.Where("customer_id = ? AND script_id = ? AND status = ?", req.CustomerID, req.ScriptID, model.SubscriptionStatusActive).
		First(&activeSub).Error
	if err == nil {
		hasActiveSub = true
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	base := time.Now().UTC()
	if hasActiveSub && activeSub.ExpiresAt != nil && activeSub.ExpiresAt.After(base) {
		base = *activeSub.ExpiresAt
	}

	expiration, err := calculateExpiration(req.PlanType, req.RequestedDays, script.TrialDays, base)
	if err != nil {
		return err
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return errcode.Wrap(errcode.ErrInternal, tx.Error)
	}

	validatedCustomer, err := s.customers.EnsureValidatedCustomer(tx, req.CustomerID)
	if err != nil {
		tx.Rollback()
		return err
	}

	remoteSnapshot, err := snapshotTradingViewAccess(s.tv, script.PineID, validatedCustomer.TVUsername)
	if err != nil {
		tx.Rollback()
		return err
	}

	if err := syncTradingViewAccess(s.tv, script.PineID, validatedCustomer.TVUsername, expiration); err != nil {
		tx.Rollback()
		return err
	}

	now := time.Now().UTC()
	if hasActiveSub {
		activeSub.PlanType = req.PlanType
		activeSub.Status = model.SubscriptionStatusActive
		activeSub.TVGranted = true
		activeSub.ExpiresAt = expiration
		activeSub.LastRequestID = &req.ID
		activeSub.GrantedBy = &reviewerID
		if err := tx.Save(&activeSub).Error; err != nil {
			tx.Rollback()
			return s.compensateApproveFailure(script.PineID, validatedCustomer.TVUsername, remoteSnapshot, err)
		}
	} else {
		sub := model.Subscription{
			CustomerID:    req.CustomerID,
			ScriptID:      req.ScriptID,
			PlanType:      req.PlanType,
			Status:        model.SubscriptionStatusActive,
			TVGranted:     true,
			StartedAt:     now,
			ExpiresAt:     expiration,
			LastRequestID: &req.ID,
			GrantedBy:     &reviewerID,
		}
		if err := tx.Create(&sub).Error; err != nil {
			tx.Rollback()
			return s.compensateApproveFailure(script.PineID, validatedCustomer.TVUsername, remoteSnapshot, err)
		}
	}

	if err := tx.Model(&model.AccessRequest{}).Where("id = ?", req.ID).Updates(map[string]any{
		"status":      model.RequestStatusApproved,
		"reviewed_by": reviewerID,
		"reviewed_at": now,
	}).Error; err != nil {
		tx.Rollback()
		return s.compensateApproveFailure(script.PineID, validatedCustomer.TVUsername, remoteSnapshot, err)
	}

	if err := writeOperationLog(tx, reviewerID, "approve_request", "access_request", &req.ID, map[string]any{
		"request_no":  req.RequestNo,
		"script_id":   req.ScriptID,
		"customer_id": req.CustomerID,
		"tv_username": validatedCustomer.TVUsername,
	}, ""); err != nil {
		tx.Rollback()
		return s.compensateApproveFailure(script.PineID, validatedCustomer.TVUsername, remoteSnapshot, err)
	}

	if err := tx.Commit().Error; err != nil {
		return s.compensateApproveFailure(script.PineID, validatedCustomer.TVUsername, remoteSnapshot, err)
	}
	return nil
}

func (s *ReviewService) RejectRequest(reviewerID, requestID uint64, reason string, scope ScriptScope) error {
	req, err := s.GetByID(requestID, nil, Unrestricted())
	if err != nil {
		return err
	}
	if !scope.Allows(req.ScriptID) {
		return errcode.ErrScriptNotPermitted
	}
	if req.Status != model.RequestStatusPending {
		return errcode.ErrRequestStatus
	}

	now := time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return errcode.Wrap(errcode.ErrInternal, tx.Error)
	}
	if err := tx.Model(&model.AccessRequest{}).Where("id = ?", req.ID).Updates(map[string]any{
		"status":        model.RequestStatusRejected,
		"reviewed_by":   reviewerID,
		"reviewed_at":   now,
		"reject_reason": reason,
	}).Error; err != nil {
		tx.Rollback()
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	if err := writeOperationLog(tx, reviewerID, "reject_request", "access_request", &req.ID, map[string]any{
		"reason": reason,
	}, ""); err != nil {
		tx.Rollback()
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	return tx.Commit().Error
}

func (s *ReviewService) BatchApprove(reviewerID uint64, requestIDs []uint64, scope ScriptScope) (*BatchResult, error) {
	result := &BatchResult{
		SuccessIDs: make([]uint64, 0, len(requestIDs)),
		Failed:     make(map[uint64]string),
	}
	for _, requestID := range requestIDs {
		if err := s.ApproveRequest(reviewerID, requestID, scope); err != nil {
			result.Failed[requestID] = err.Error()
			continue
		}
		result.SuccessIDs = append(result.SuccessIDs, requestID)
	}
	return result, nil
}

func (s *ReviewService) ensureNoPendingDuplicate(tx *gorm.DB, agentID, customerID, scriptID uint64) error {
	var count int64
	if err := tx.Model(&model.AccessRequest{}).
		Where("agent_id = ? AND customer_id = ? AND script_id = ? AND status = ?", agentID, customerID, scriptID, model.RequestStatusPending).
		Count(&count).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	if count > 0 {
		return errcode.ErrDuplicateRequest
	}
	return nil
}

func (s *ReviewService) compensateApproveFailure(pineID, username string, snapshot *TVAccessSnapshot, cause error) error {
	rollbackErr := restoreTradingViewAccess(s.tv, pineID, username, snapshot)
	if rollbackErr != nil {
		s.logger.Error("failed to compensate tradingview access after approve failure", zap.String("pine_id", pineID), zap.String("username", username), zap.Error(rollbackErr), zap.Error(cause))
		return errcode.Wrap(errcode.ErrInternal, fmt.Errorf("db write failed: %w; tradingview compensation failed: %v", cause, rollbackErr))
	}
	return errcode.Wrap(errcode.ErrInternal, cause)
}
