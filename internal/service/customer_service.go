package service

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

type CreateCustomerDTO struct {
	TVUsername string  `json:"tv_username" binding:"required"`
	Contact    string  `json:"contact"`
	Remark     string  `json:"remark"`
	AgentID    *uint64 `json:"agent_id"`
}

type UpdateCustomerDTO struct {
	Contact string `json:"contact"`
	Remark  string `json:"remark"`
}

type CustomerDetail struct {
	Customer      model.Customer       `json:"customer"`
	Subscriptions []model.Subscription `json:"subscriptions"`
}

type SubscriptionBrief struct {
	SubscriptionID uint64     `json:"subscription_id"`
	ScriptName     string     `json:"script_name"`
	PlanType       string     `json:"plan_type"`
	ExpiresAt      *time.Time `json:"expires_at"`
}

type CustomerListItem struct {
	model.Customer
	ActiveSubscriptions []SubscriptionBrief `json:"active_subscriptions"`
	PendingRequestCount int64               `json:"pending_request_count"`
}

type CustomerService struct {
	db *gorm.DB
	tv TVProxy
}

func NewCustomerService(db *gorm.DB, tv TVProxy) *CustomerService {
	return &CustomerService{db: db, tv: tv}
}

func (s *CustomerService) ValidateTVUsername(keyword string) ([]TVUserHint, error) {
	return s.tv.ValidateUsername(keyword)
}

func normalizeTVUsername(username string) string {
	return strings.TrimSpace(username)
}

func (s *CustomerService) resolveTVUsername(username string) (*TVUserHint, error) {
	username = normalizeTVUsername(username)
	if username == "" {
		return nil, errcode.ErrValidation
	}

	hints, err := s.tv.ValidateUsername(username)
	if err != nil {
		return nil, err
	}

	for _, hint := range hints {
		if strings.EqualFold(hint.Username, username) {
			item := hint
			return &item, nil
		}
	}
	return nil, errcode.ErrTVUsernameNotFound
}

func (s *CustomerService) findExistingByUsername(tx *gorm.DB, username string) (*model.Customer, error) {
	username = normalizeTVUsername(username)

	var customer model.Customer
	if err := tx.Where("LOWER(tv_username) = LOWER(?)", username).First(&customer).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &customer, nil
}

func (s *CustomerService) List(filter CustomerFilter, scope ScriptScope) (*PageResult, error) {
	filter.Normalize()

	var total int64
	query := s.db.Model(&model.Customer{})
	if filter.AgentID != nil {
		query = query.Where("agent_id = ?", *filter.AgentID)
	}
	query = s.applyCustomerScope(query, scope)
	if filter.Keyword != "" {
		query = query.Where("tv_username LIKE ? OR contact LIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")
	}
	query = s.applySubscriptionStatusFilter(query, filter, scope)
	if err := query.Count(&total).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var list []model.Customer
	if err := query.Order("id DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Find(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	items, err := s.buildCustomerListItems(list, filter.AgentID, scope)
	if err != nil {
		return nil, err
	}

	return &PageResult{List: items, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *CustomerService) Create(dto CreateCustomerDTO, createdBy *uint64) (*model.Customer, error) {
	dto.TVUsername = normalizeTVUsername(dto.TVUsername)
	matched, err := s.resolveTVUsername(dto.TVUsername)
	if err != nil {
		return nil, err
	}
	dto.TVUsername = matched.Username

	existing, err := s.findExistingByUsername(s.db, dto.TVUsername)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errcode.ErrCustomerUsernameDup
	}

	tvID := matched.ID
	customer := model.Customer{
		TVUsername: dto.TVUsername,
		TVUserID:   &tvID,
		Contact:    dto.Contact,
		Remark:     dto.Remark,
		AgentID:    dto.AgentID,
		CreatedBy:  createdBy,
	}
	if err := s.db.Create(&customer).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &customer, nil
}

func (s *CustomerService) CreatePending(dto CreateCustomerDTO, createdBy *uint64) (*model.Customer, error) {
	dto.TVUsername = normalizeTVUsername(dto.TVUsername)
	if dto.TVUsername == "" {
		return nil, errcode.ErrValidation
	}

	existing, err := s.findExistingByUsername(s.db, dto.TVUsername)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errcode.ErrCustomerUsernameDup
	}

	customer := model.Customer{
		TVUsername: dto.TVUsername,
		Contact:    dto.Contact,
		Remark:     dto.Remark,
		AgentID:    dto.AgentID,
		CreatedBy:  createdBy,
	}
	if err := s.db.Create(&customer).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &customer, nil
}

func (s *CustomerService) GetByID(id uint64, agentID *uint64, scope ScriptScope) (*CustomerDetail, error) {
	var customer model.Customer
	query := s.db.Model(&model.Customer{}).Where("customers.id = ?", id)
	if agentID != nil {
		query = query.Where("agent_id = ?", *agentID)
	}
	query = s.applyCustomerScope(query, scope)
	if err := query.First(&customer).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrCustomerNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var subs []model.Subscription
	subQuery := s.db.Preload("Script").
		Where("customer_id = ?", customer.ID).
		Order("id DESC")
	subQuery = scope.ApplyToQuery(subQuery, "script_id")
	if err := subQuery.Find(&subs).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	return &CustomerDetail{Customer: customer, Subscriptions: subs}, nil
}

func (s *CustomerService) Update(id uint64, agentID *uint64, dto UpdateCustomerDTO, scope ScriptScope) (*model.Customer, error) {
	var customer model.Customer
	query := s.db.Model(&model.Customer{}).Where("customers.id = ?", id)
	if agentID != nil {
		query = query.Where("agent_id = ?", *agentID)
	}
	query = s.applyCustomerScope(query, scope)
	if err := query.First(&customer).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrCustomerNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	if err := s.db.Model(&customer).Updates(map[string]any{
		"contact": dto.Contact,
		"remark":  dto.Remark,
	}).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return s.findCustomerByID(id)
}

func (s *CustomerService) FindOrCreatePendingByUsername(
	tx *gorm.DB,
	agentID *uint64,
	tvUsername, contact, remark string,
	createdBy *uint64,
) (*model.Customer, error) {
	tvUsername = normalizeTVUsername(tvUsername)
	if tvUsername == "" {
		return nil, errcode.ErrValidation
	}

	existing, err := s.findExistingByUsername(tx, tvUsername)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		updates := map[string]any{}
		if agentID != nil && existing.AgentID == nil {
			updates["agent_id"] = *agentID
			existing.AgentID = agentID
		}
		if createdBy != nil && existing.CreatedBy == nil {
			updates["created_by"] = *createdBy
			existing.CreatedBy = createdBy
		}
		if len(updates) > 0 {
			if err := tx.Model(existing).Updates(updates).Error; err != nil {
				return nil, errcode.Wrap(errcode.ErrInternal, err)
			}
		}
		return existing, nil
	}

	customer := model.Customer{
		TVUsername: tvUsername,
		Contact:    contact,
		Remark:     remark,
		AgentID:    agentID,
		CreatedBy:  createdBy,
	}
	if err := tx.Create(&customer).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &customer, nil
}

func (s *CustomerService) EnsureValidatedCustomer(tx *gorm.DB, customerID uint64) (*model.Customer, error) {
	var customer model.Customer
	if err := tx.Where("id = ?", customerID).First(&customer).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrCustomerNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	matched, err := s.resolveTVUsername(customer.TVUsername)
	if err != nil {
		return nil, err
	}

	if existing, err := s.findExistingByUsername(tx, matched.Username); err != nil {
		return nil, err
	} else if existing != nil && existing.ID != customer.ID {
		return nil, errcode.ErrCustomerUsernameDup
	}

	tvID := matched.ID
	updates := map[string]any{}
	if customer.TVUsername != matched.Username {
		updates["tv_username"] = matched.Username
	}
	if customer.TVUserID == nil || *customer.TVUserID != tvID {
		updates["tv_user_id"] = tvID
	}

	if len(updates) > 0 {
		if err := tx.Model(&customer).Updates(updates).Error; err != nil {
			return nil, errcode.Wrap(errcode.ErrInternal, err)
		}
		customer.TVUsername = matched.Username
		customer.TVUserID = &tvID
	}

	return &customer, nil
}

func (s *CustomerService) findCustomerByID(id uint64) (*model.Customer, error) {
	var customer model.Customer
	if err := s.db.First(&customer, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrCustomerNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &customer, nil
}

func (s *CustomerService) applyCustomerScope(query *gorm.DB, scope ScriptScope) *gorm.DB {
	if !scope.Scoped {
		return query
	}
	if len(scope.ScriptIDs) == 0 {
		if scope.UserID > 0 {
			return query.Where("customers.created_by = ?", scope.UserID)
		}
		return query.Where("1 = 0")
	}

	subscriptionCustomerIDs := s.db.Model(&model.Subscription{}).
		Select("customer_id").
		Where("script_id IN ?", scope.ScriptIDs)

	if scope.UserID > 0 {
		return query.Where("(customers.id IN (?) OR customers.created_by = ?)", subscriptionCustomerIDs, scope.UserID)
	}

	return query.Where("customers.id IN (?)", subscriptionCustomerIDs)
}

func (s *CustomerService) applySubscriptionStatusFilter(query *gorm.DB, filter CustomerFilter, scope ScriptScope) *gorm.DB {
	switch filter.SubscriptionStatus {
	case "", "all":
		return query
	case "active":
		subQuery := s.db.Model(&model.Subscription{}).
			Select("customer_id").
			Where("status = ?", model.SubscriptionStatusActive)
		subQuery = scope.ApplyToQuery(subQuery, "script_id")
		return query.Where("customers.id IN (?)", subQuery)
	case "expiring_soon":
		deadline := time.Now().UTC().AddDate(0, 0, 7)
		subQuery := s.db.Model(&model.Subscription{}).
			Select("customer_id").
			Where("status = ? AND expires_at IS NOT NULL AND expires_at <= ?", model.SubscriptionStatusActive, deadline)
		subQuery = scope.ApplyToQuery(subQuery, "script_id")
		return query.Where("customers.id IN (?)", subQuery)
	case "no_subscription":
		subQuery := s.db.Model(&model.Subscription{}).
			Select("customer_id").
			Where("status = ?", model.SubscriptionStatusActive)
		subQuery = scope.ApplyToQuery(subQuery, "script_id")
		return query.Where("customers.id NOT IN (?)", subQuery)
	case "pending":
		requestQuery := s.db.Model(&model.AccessRequest{}).
			Select("customer_id").
			Where("status = ?", model.RequestStatusPending)
		if filter.AgentID != nil {
			requestQuery = requestQuery.Where("agent_id = ?", *filter.AgentID)
		}
		requestQuery = scope.ApplyToQuery(requestQuery, "script_id")
		return query.Where("customers.id IN (?)", requestQuery)
	default:
		return query
	}
}

func (s *CustomerService) buildCustomerListItems(
	customers []model.Customer,
	agentID *uint64,
	scope ScriptScope,
) ([]CustomerListItem, error) {
	if len(customers) == 0 {
		return []CustomerListItem{}, nil
	}

	customerIDs := make([]uint64, 0, len(customers))
	for _, customer := range customers {
		customerIDs = append(customerIDs, customer.ID)
	}

	activeSubscriptions, err := s.loadActiveSubscriptionBriefs(customerIDs, scope)
	if err != nil {
		return nil, err
	}

	pendingCounts, err := s.loadPendingRequestCounts(customerIDs, agentID, scope)
	if err != nil {
		return nil, err
	}

	items := make([]CustomerListItem, 0, len(customers))
	for _, customer := range customers {
		items = append(items, CustomerListItem{
			Customer:             customer,
			ActiveSubscriptions:  activeSubscriptions[customer.ID],
			PendingRequestCount:  pendingCounts[customer.ID],
		})
	}

	return items, nil
}

func (s *CustomerService) loadActiveSubscriptionBriefs(
	customerIDs []uint64,
	scope ScriptScope,
) (map[uint64][]SubscriptionBrief, error) {
	var subscriptions []model.Subscription
	query := s.db.Preload("Script").
		Where("customer_id IN ? AND status = ?", customerIDs, model.SubscriptionStatusActive).
		Order("customer_id ASC").
		Order("expires_at ASC").
		Order("id DESC")
	query = scope.ApplyToQuery(query, "script_id")
	if err := query.Find(&subscriptions).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	result := make(map[uint64][]SubscriptionBrief, len(customerIDs))
	for _, subscription := range subscriptions {
		result[subscription.CustomerID] = append(result[subscription.CustomerID], SubscriptionBrief{
			SubscriptionID: subscription.ID,
			ScriptName:     subscription.Script.Name,
			PlanType:       subscription.PlanType,
			ExpiresAt:      subscription.ExpiresAt,
		})
	}
	return result, nil
}

func (s *CustomerService) loadPendingRequestCounts(
	customerIDs []uint64,
	agentID *uint64,
	scope ScriptScope,
) (map[uint64]int64, error) {
	type pendingCountRow struct {
		CustomerID uint64 `gorm:"column:customer_id"`
		Count      int64  `gorm:"column:count"`
	}

	var rows []pendingCountRow
	query := s.db.Model(&model.AccessRequest{}).
		Select("customer_id, COUNT(*) AS count").
		Where("customer_id IN ? AND status = ?", customerIDs, model.RequestStatusPending)
	if agentID != nil {
		query = query.Where("agent_id = ?", *agentID)
	}
	query = scope.ApplyToQuery(query, "script_id")
	if err := query.Group("customer_id").Find(&rows).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	result := make(map[uint64]int64, len(rows))
	for _, row := range rows {
		result[row.CustomerID] = row.Count
	}
	return result, nil
}
