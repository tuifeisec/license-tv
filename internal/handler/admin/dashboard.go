package admin

import (
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/response"
)

type DashboardHandler struct {
	db *gorm.DB
}

func NewDashboardHandler(db *gorm.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

func (h *DashboardHandler) Stats(c *gin.Context) {
	scope := extractScriptScope(c)

	var adminCount int64
	var agentCount int64
	var scriptCount int64
	var customerCount int64
	var pendingCount int64
	var activeSubCount int64
	var totalAmount float64
	var monthAmount float64
	monthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)

	h.db.Model(&model.SystemUser{}).Where("role IN ?", []string{model.RoleAdmin, model.RoleSuperAdmin}).Count(&adminCount)
	h.db.Model(&model.SystemUser{}).Where("role = ?", model.RoleAgent).Count(&agentCount)

	if !scope.Scoped {
		h.db.Model(&model.Script{}).Count(&scriptCount)
		h.db.Model(&model.Customer{}).Count(&customerCount)
		h.db.Model(&model.AccessRequest{}).Where("status = ?", model.RequestStatusPending).Count(&pendingCount)
		h.db.Model(&model.Subscription{}).Where("status = ?", model.SubscriptionStatusActive).Count(&activeSubCount)

		h.db.Model(&model.AccessRequest{}).
			Where("status = ?", model.RequestStatusApproved).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&totalAmount)

		h.db.Model(&model.AccessRequest{}).
			Where("status = ? AND reviewed_at >= ?", model.RequestStatusApproved, monthStart).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&monthAmount)
	} else {
		if len(scope.ScriptIDs) > 0 {
			h.db.Model(&model.Script{}).Where("id IN ?", scope.ScriptIDs).Count(&scriptCount)
		}

		customerQuery := h.db.Model(&model.Customer{})
		if len(scope.ScriptIDs) == 0 {
			customerQuery = customerQuery.Where("created_by = ?", scope.UserID)
		} else {
			customerSubQuery := h.db.Model(&model.Subscription{}).
				Select("customer_id").
				Where("script_id IN ?", scope.ScriptIDs)
			customerQuery = customerQuery.Where("(customers.id IN (?) OR customers.created_by = ?)", customerSubQuery, scope.UserID)
		}
		customerQuery.Count(&customerCount)

		requestQuery := scope.ApplyToQuery(h.db.Model(&model.AccessRequest{}), "script_id")
		requestQuery.Where("status = ?", model.RequestStatusPending).Count(&pendingCount)

		subQuery := scope.ApplyToQuery(h.db.Model(&model.Subscription{}), "script_id")
		subQuery.Where("status = ?", model.SubscriptionStatusActive).Count(&activeSubCount)

		amountQuery := scope.ApplyToQuery(h.db.Model(&model.AccessRequest{}), "script_id")
		amountQuery.
			Where("status = ?", model.RequestStatusApproved).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&totalAmount)

		amountQuery = scope.ApplyToQuery(h.db.Model(&model.AccessRequest{}), "script_id")
		amountQuery.
			Where("status = ? AND reviewed_at >= ?", model.RequestStatusApproved, monthStart).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&monthAmount)
	}

	response.Success(c, gin.H{
		"admin_count":               adminCount,
		"agent_count":               agentCount,
		"script_count":              scriptCount,
		"customer_count":            customerCount,
		"pending_request_count":     pendingCount,
		"active_subscription_count": activeSubCount,
		"approved_amount_total":     totalAmount,
		"approved_amount_month":     monthAmount,
	})
}
