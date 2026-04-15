package middleware

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
)

func Recovery(logger *zap.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered any) {
		logger.Error("panic recovered", zap.Any("error", recovered), zap.String("path", c.Request.URL.Path))
		response.Error(c, errcode.ErrInternal)
	})
}
