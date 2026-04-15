package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type counter struct {
	Count   int
	ResetAt time.Time
}

func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	var mu sync.Mutex
	store := map[string]*counter{}

	return func(c *gin.Context) {
		key := c.ClientIP() + ":" + c.FullPath()
		now := time.Now()

		mu.Lock()
		item, ok := store[key]
		if !ok || now.After(item.ResetAt) {
			item = &counter{Count: 0, ResetAt: now.Add(window)}
			store[key] = item
		}
		item.Count++
		allowed := item.Count <= limit
		mu.Unlock()

		if !allowed {
			c.AbortWithStatusJSON(429, gin.H{
				"code":    10007,
				"message": "too many requests",
				"data":    nil,
			})
			return
		}
		c.Next()
	}
}
