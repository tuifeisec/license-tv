package admin

import (
	"github.com/gin-gonic/gin"

	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

type AgentMgmtHandler struct {
	auth *service.AuthService
}

func NewAgentMgmtHandler(auth *service.AuthService) *AgentMgmtHandler {
	return &AgentMgmtHandler{auth: auth}
}

func (h *AgentMgmtHandler) List(c *gin.Context) {
	var filter service.AgentListFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.auth.ListAgents(filter)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, result)
}

func (h *AgentMgmtHandler) Create(c *gin.Context) {
	var req service.CreateAgentDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.auth.CreateAgent(req)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *AgentMgmtHandler) Update(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.UpdateAgentDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.auth.UpdateAgent(id, req)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *AgentMgmtHandler) ResetPassword(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.ResetAgentPasswordDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	if err := h.auth.ResetAgentPassword(id, req); err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"updated": true})
}

func (h *AgentMgmtHandler) Get(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.auth.GetAgentDetail(id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}
