package admin

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tv-distribution/internal/middleware"
	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

type TVSessionHandler struct {
	db          *gorm.DB
	session     *service.TVSessionService
	auditSvc    *service.AccessAuditService
	overviewSvc *service.TVAccessOverviewService
	syncSvc     *service.TVAccessSyncService
}

func NewTVSessionHandler(
	db *gorm.DB,
	session *service.TVSessionService,
	auditSvc *service.AccessAuditService,
	overviewSvc *service.TVAccessOverviewService,
	syncSvc *service.TVAccessSyncService,
) *TVSessionHandler {
	return &TVSessionHandler{
		db:          db,
		session:     session,
		auditSvc:    auditSvc,
		overviewSvc: overviewSvc,
		syncSvc:     syncSvc,
	}
}

func (h *TVSessionHandler) Status(c *gin.Context) {
	status := h.session.SessionStatus()
	account, err := h.session.ValidateSession()
	if err != nil {
		response.Success(c, gin.H{
			"status": status,
			"valid":  false,
			"error":  err.Error(),
		})
		return
	}
	response.Success(c, gin.H{
		"status":  status,
		"valid":   true,
		"account": account,
	})
}

func (h *TVSessionHandler) Update(c *gin.Context) {
	var req struct {
		SessionID     string `json:"sessionid" binding:"required"`
		SessionIDSign string `json:"sessionid_sign" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	if err := h.session.UpdateCookies(req.SessionID, req.SessionIDSign); err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"updated": true})
}

func (h *TVSessionHandler) SyncAccess(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	result, err := h.auditSvc.Run(user.UserID, middleware.ClientIP(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *TVSessionHandler) OperationLogs(c *gin.Context) {
	var filter service.ListFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	filter.Normalize()

	query := h.db.Model(&model.OperationLog{})
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		response.Error(c, err)
		return
	}

	var list []model.OperationLog
	if err := query.Order("id DESC").Offset((filter.Page - 1) * filter.PageSize).Limit(filter.PageSize).Find(&list).Error; err != nil {
		response.Error(c, err)
		return
	}

	response.Page(c, &service.PageResult{
		List:     list,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	})
}

func (h *TVSessionHandler) TVAccessOverview(c *gin.Context) {
	var filter service.TVAccessOverviewFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}

	result, err := h.overviewSvc.List(filter)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *TVSessionHandler) SyncTVAccess(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}

	var req struct {
		ScriptID *uint64 `json:"script_id"`
	}
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, errcode.ErrValidation)
			return
		}
	}

	var (
		result *service.TVAccessSyncResult
		err    error
	)
	if req.ScriptID != nil && *req.ScriptID > 0 {
		result, err = h.syncSvc.SyncByScriptID(*req.ScriptID, user.UserID, middleware.ClientIP(c))
	} else {
		result, err = h.syncSvc.SyncAll(user.UserID, middleware.ClientIP(c))
	}
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}
