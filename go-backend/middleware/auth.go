package middleware

import (
	"net/http"
	"strings"

	"colorai-backend/service"

	"github.com/gin-gonic/gin"
)

// RequireAuth 鉴权中间件
// 从 Authorization header 取 token，通过 AuthService 校验
// 校验通过后将用户信息写入 c.Set("user_id", ...) / c.Set("user", ...)
func RequireAuth(authSvc service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "未提供认证 token",
			})
			return
		}

		if strings.HasPrefix(token, "Bearer ") {
			token = token[7:]
		}

		userID, username, phone, err := authSvc.ValidateToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   err.Error(),
			})
			return
		}

		c.Set("user_id", userID)
		c.Set("user", gin.H{
			"id":       userID,
			"username": username,
			"phone":    phone,
		})
		c.Next()
	}
}
