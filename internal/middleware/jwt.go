package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"tv-distribution/internal/pkg/authcookie"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

const currentUserKey = "current_user"

func JWTAuth(auth *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		token := ""
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
		if token == "" {
			cookieToken, err := c.Cookie(authcookie.AccessTokenName)
			if err == nil {
				token = cookieToken
			}
		}
		if token == "" {
			response.Error(c, errcode.ErrUnauthorized)
			c.Abort()
			return
		}

		claims, err := auth.ParseAccessToken(token)
		if err != nil {
			response.Error(c, err)
			c.Abort()
			return
		}

		c.Set(currentUserKey, claims)
		c.Next()
	}
}

func CurrentUser(c *gin.Context) *service.TokenClaims {
	v, ok := c.Get(currentUserKey)
	if !ok {
		return nil
	}
	claims, _ := v.(*service.TokenClaims)
	return claims
}
