package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// UserProfile 获取当前登录用户信息
// GET /api/user/profile
func UserProfile(c *gin.Context) {
	// RequireAuth 中间件已校验 token 并注入 user 信息
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "未登录",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"user":    user,
	})
}
