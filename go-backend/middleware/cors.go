package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// CORS 跨域中间件
// 允许前端开发服务器访问后端 API
func CORS() gin.HandlerFunc {
	// 允许的来源列表(可通过环境变量 CORS_ORIGINS 逗号分隔覆盖)
	origins := map[string]bool{
		"http://localhost:5173": true,
		"http://localhost:3001": true,
	}
	if extra := os.Getenv("CORS_ORIGINS"); extra != "" {
		for _, o := range splitComma(extra) {
			origins[o] = true
		}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origins[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func splitComma(s string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			if i > start {
				result = append(result, s[start:i])
			}
			start = i + 1
		}
	}
	return result
}
