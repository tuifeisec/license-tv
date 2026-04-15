package middleware

import "github.com/gin-gonic/gin"

const clientIPKey = "client_ip"

func InjectClientIP() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(clientIPKey, c.ClientIP())
		c.Next()
	}
}

func ClientIP(c *gin.Context) string {
	v, ok := c.Get(clientIPKey)
	if !ok {
		return c.ClientIP()
	}
	ip, _ := v.(string)
	return ip
}
