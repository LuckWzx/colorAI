package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AuthRegister 用户注册(桩函数,待实现)
// POST /api/auth/register
func AuthRegister(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"success": false,
		"error":   "Not implemented yet",
	})
}

// AuthLogin 用户登录(桩函数,待实现)
// POST /api/auth/login
func AuthLogin(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"success": false,
		"error":   "Not implemented yet",
	})
}

// AuthLogout 用户登出(桩函数,待实现)
// POST /api/auth/logout
func AuthLogout(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"success": false,
		"error":   "Not implemented yet",
	})
}
