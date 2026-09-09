package middleware

import (
	"context"
	"net/http"
	"strings"

	"colorai-backend/database"

	"github.com/gin-gonic/gin"
)

// RequireAuth 鉴权中间件
// 从 Authorization header 取 token，在 Redis 中校验
// 校验通过后将用户信息写入 c.Set("user_id", ...) / c.Set("user", ...)
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "未提供认证 token",
			})
			return
		}

		// 去掉 "Bearer " 前缀
		if strings.HasPrefix(token, "Bearer ") {
			token = token[7:]
		}

		ctx := context.Background()
		val, err := database.RDB.Get(ctx, "token:"+token).Result()
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "token 无效或已过期",
			})
			return
		}

		// 解析 user_id|username|phone
		parts := strings.SplitN(val, "|", 3)
		if len(parts) < 3 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "token 数据格式错误",
			})
			return
		}

		c.Set("user_id", parts[0])
		c.Set("user", gin.H{
			"id":       parts[0],
			"username": parts[1],
			"phone":    parts[2],
		})
		c.Next()
	}
}
