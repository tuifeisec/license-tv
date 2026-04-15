package admin

import (
	"github.com/gin-gonic/gin"

	"tv-distribution/internal/middleware"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

type SubscriptionHandler struct {
	subs *service.SubscriptionService
}

func NewSubscriptionHandler(subs *service.SubscriptionService) *SubscriptionHandler {
	return &SubscriptionHandler{subs: subs}
}

func (h *SubscriptionHandler) List(c *gin.Context) {
	var filter service.SubscriptionFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.subs.List(filter, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, result)
}

func (h *SubscriptionHandler) Create(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	var req service.DirectGrantDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.subs.DirectGrant(user.UserID, req, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *SubscriptionHandler) Renew(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	var req service.RenewDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.subs.DirectRenew(user.UserID, id, req, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *SubscriptionHandler) Revoke(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	if err := h.subs.Revoke(user.UserID, id, req.Reason, extractScriptScope(c)); err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"revoked": true})
}

func (h *SubscriptionHandler) Get(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.subs.GetByID(id, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}
