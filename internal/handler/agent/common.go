package agent

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
)

func parseIDParam(c *gin.Context, key string) (uint64, bool) {
	value, err := strconv.ParseUint(c.Param(key), 10, 64)
	if err != nil {
		response.Error(c, errcode.ErrValidation)
		return 0, false
	}
	return value, true
}
