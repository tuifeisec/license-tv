package admin

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"tv-distribution/internal/middleware"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

func parseIDParam(c *gin.Context, key string) (uint64, bool) {
	value, err := strconv.ParseUint(c.Param(key), 10, 64)
	if err != nil {
		response.Error(c, errcode.ErrValidation)
		return 0, false
	}
	return value, true
}

func extractScriptScope(c *gin.Context) service.ScriptScope {
	ids, scoped := middleware.ScopedScriptIDs(c)
	if !scoped {
		return service.Unrestricted()
	}

	user := middleware.CurrentUser(c)
	if user == nil {
		return service.Unrestricted()
	}
	return service.RestrictedTo(user.UserID, ids)
}
