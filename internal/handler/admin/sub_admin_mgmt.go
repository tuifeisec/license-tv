package admin

import (
	"github.com/gin-gonic/gin"

	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

type SubAdminMgmtHandler struct {
	auth *service.AuthService
}

func NewSubAdminMgmtHandler(auth *service.AuthService) *SubAdminMgmtHandler {
	return &SubAdminMgmtHandler{auth: auth}
}

func (h *SubAdminMgmtHandler) List(c *gin.Context) {
	var filter service.SubAdminListFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.auth.ListSubAdmins(filter)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, result)
}

func (h *SubAdminMgmtHandler) Create(c *gin.Context) {
	var req service.CreateSubAdminDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.auth.CreateSubAdmin(req)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *SubAdminMgmtHandler) Get(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.auth.GetSubAdminDetail(id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *SubAdminMgmtHandler) Update(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.UpdateSubAdminDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.auth.UpdateSubAdmin(id, req)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *SubAdminMgmtHandler) ResetPassword(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.ResetAgentPasswordDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	if err := h.auth.ResetSubAdminPassword(id, req); err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"updated": true})
}

func (h *SubAdminMgmtHandler) UpdateScripts(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.UpdateSubAdminScriptsDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	if err := h.auth.UpdateSubAdminScripts(id, req); err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"updated": true})
}
