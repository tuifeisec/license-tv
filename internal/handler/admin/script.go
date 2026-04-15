package admin

import (
	"strings"

	"github.com/gin-gonic/gin"

	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

type ScriptHandler struct {
	scripts *service.ScriptService
}

func NewScriptHandler(scripts *service.ScriptService) *ScriptHandler {
	return &ScriptHandler{scripts: scripts}
}

func (h *ScriptHandler) Sync(c *gin.Context) {
	count, err := h.scripts.SyncScripts()
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"synced": count})
}

func (h *ScriptHandler) List(c *gin.Context) {
	var filter service.ScriptListFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}

	activeOnlyRaw := strings.TrimSpace(strings.ToLower(c.Query("active_only")))
	activeOnly := activeOnlyRaw == "1" || activeOnlyRaw == "true"

	result, err := h.scripts.List(filter, activeOnly, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, result)
}

func (h *ScriptHandler) Get(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.scripts.GetByID(id, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *ScriptHandler) Update(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.UpdateScriptDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.scripts.Update(id, req, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *ScriptHandler) Users(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.scripts.ListAuthorizedUsers(id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}
