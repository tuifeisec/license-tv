package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tv-distribution/internal/service"
)

type HealthHandler struct {
	db *gorm.DB
	tv service.TVProxy
}

func NewHealthHandler(db *gorm.DB, tv service.TVProxy) *HealthHandler {
	return &HealthHandler{
		db: db,
		tv: tv,
	}
}

func (h *HealthHandler) Check(c *gin.Context) {
	status := gin.H{
		"status": "ok",
		"time":   time.Now().UTC(),
		"checks": gin.H{
			"database":      "ok",
			"tv_configured": h.tv.SessionStatus().Configured,
		},
	}

	sqlDB, err := h.db.DB()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "degraded",
			"time":   time.Now().UTC(),
			"checks": gin.H{
				"database": "unavailable",
				"error":    err.Error(),
			},
		})
		return
	}

	if err := sqlDB.PingContext(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "degraded",
			"time":   time.Now().UTC(),
			"checks": gin.H{
				"database":      "unavailable",
				"tv_configured": h.tv.SessionStatus().Configured,
				"error":         err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, status)
}
