package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// UserController 用户信息 HTTP 处理器
type UserController struct{}

// NewUserController 创建 UserController 实例
func NewUserController() *UserController {
	return &UserController{}
}

// UserProfile 获取当前登录用户信息
// GET /api/user/profile
func (h *UserController) UserProfile(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "未登录",
		})
		return
	}

	OK(c, gin.H{"user": user})
}
