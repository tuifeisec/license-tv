package agent

import (
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tv-distribution/internal/middleware"
	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

type StatsHandler struct {
	db        *gorm.DB
	scripts   *service.ScriptService
	customers *service.CustomerService
}

func NewStatsHandler(db *gorm.DB, scripts *service.ScriptService, customers *service.CustomerService) *StatsHandler {
	return &StatsHandler{db: db, scripts: scripts, customers: customers}
}

func (h *StatsHandler) ListScripts(c *gin.Context) {
	var filter service.ScriptListFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.scripts.List(filter, true, service.Unrestricted())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, result)
}

func (h *StatsHandler) ValidateTVUsername(c *gin.Context) {
	keyword := c.Query("keyword")
	if keyword == "" {
		keyword = c.Query("s")
	}
	if keyword == "" {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.customers.ValidateTVUsername(keyword)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *StatsHandler) Stats(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}

	var customerCount int64
	var pendingCount int64
	var activeSubCount int64
	var totalAmount float64
	var monthAmount float64

	h.db.Model(&model.Customer{}).Where("agent_id = ?", user.UserID).Count(&customerCount)
	h.db.Model(&model.AccessRequest{}).Where("agent_id = ? AND status = ?", user.UserID, model.RequestStatusPending).Count(&pendingCount)
	h.db.Model(&model.Subscription{}).
		Joins("JOIN customers ON customers.id = subscriptions.customer_id").
		Where("customers.agent_id = ? AND subscriptions.status = ?", user.UserID, model.SubscriptionStatusActive).
		Count(&activeSubCount)
	h.db.Model(&model.AccessRequest{}).
		Where("agent_id = ? AND status = ?", user.UserID, model.RequestStatusApproved).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&totalAmount)

	monthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)
	h.db.Model(&model.AccessRequest{}).
		Where("agent_id = ? AND status = ? AND reviewed_at >= ?", user.UserID, model.RequestStatusApproved, monthStart).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&monthAmount)

	response.Success(c, gin.H{
		"customer_count":            customerCount,
		"pending_request_count":     pendingCount,
		"active_subscription_count": activeSubCount,
		"approved_amount_total":     totalAmount,
		"approved_amount_month":     monthAmount,
	})
}
