package middleware

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
)

const scopedScriptIDsKey = "scoped_script_ids"

func InjectScriptScope(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := CurrentUser(c)
		if claims == nil || claims.Role != model.RoleSubAdmin {
			c.Next()
			return
		}

		var scriptIDs []uint64
		if err := db.Model(&model.UserScriptPermission{}).
			Where("user_id = ?", claims.UserID).
			Pluck("script_id", &scriptIDs).Error; err != nil {
			response.Error(c, errcode.ErrInternal)
			c.Abort()
			return
		}

		c.Set(scopedScriptIDsKey, scriptIDs)
		c.Next()
	}
}

func ScopedScriptIDs(c *gin.Context) ([]uint64, bool) {
	v, exists := c.Get(scopedScriptIDsKey)
	if !exists {
		return nil, false
	}

	ids, ok := v.([]uint64)
	if !ok {
		return nil, false
	}
	return ids, true
}
