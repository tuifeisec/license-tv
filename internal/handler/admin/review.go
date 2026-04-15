package admin

import (
	"github.com/gin-gonic/gin"

	"tv-distribution/internal/middleware"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

type ReviewHandler struct {
	reviews *service.ReviewService
}

func NewReviewHandler(reviews *service.ReviewService) *ReviewHandler {
	return &ReviewHandler{reviews: reviews}
}

func (h *ReviewHandler) List(c *gin.Context) {
	var filter service.RequestFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.reviews.ListPendingRequests(filter, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, result)
}

func (h *ReviewHandler) Get(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.reviews.GetByID(id, nil, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *ReviewHandler) Approve(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	if err := h.reviews.ApproveRequest(user.UserID, id, extractScriptScope(c)); err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"approved": true})
}

func (h *ReviewHandler) Reject(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	var req service.RejectRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	if err := h.reviews.RejectRequest(user.UserID, id, req.Reason, extractScriptScope(c)); err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"rejected": true})
}

func (h *ReviewHandler) BatchApprove(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	var req service.BatchApproveDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.reviews.BatchApprove(user.UserID, req.RequestIDs, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}
