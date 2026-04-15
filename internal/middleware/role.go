package middleware

import (
	"slices"

	"github.com/gin-gonic/gin"

	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
)

func RequireRoles(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := CurrentUser(c)
		if claims == nil || !slices.Contains(roles, claims.Role) {
			response.Error(c, errcode.ErrForbidden)
			c.Abort()
			return
		}
		c.Next()
	}
}
