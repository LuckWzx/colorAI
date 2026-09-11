package controller

import (
	"colorai-backend/model/entity"
	"net/http"
	"strings"

	"colorai-backend/service"

	"github.com/gin-gonic/gin"
)

// AuthController 认证 HTTP 处理器
type AuthController struct {
	authSvc service.AuthService
}

// NewAuthController 创建 AuthController 实例
func NewAuthController(authSvc service.AuthService) *AuthController {
	return &AuthController{authSvc: authSvc}
}

// Register 用户注册
// POST /api/auth/register
func (h *AuthController) Register(c *gin.Context) {
	var req entity.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, http.StatusBadRequest, "参数校验失败: "+err.Error())
		return
	}

	if !h.authSvc.ValidatePhone(req.Phone) {
		Fail(c, http.StatusBadRequest, "手机号格式不正确")
		return
	}

	user, token, err := h.authSvc.Register(req.Username, req.Phone, req.Password)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"user": user, "token": token})
}

// Login 用户登录
// POST /api/auth/login
func (h *AuthController) Login(c *gin.Context) {
	var req entity.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, http.StatusBadRequest, "参数校验失败: "+err.Error())
		return
	}

	if !h.authSvc.ValidatePhone(req.Phone) {
		Fail(c, http.StatusBadRequest, "手机号格式不正确")
		return
	}

	user, token, err := h.authSvc.Login(req.Phone, req.Password)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"user": user, "token": token})
}

// Logout 用户登出
// POST /api/auth/logout
func (h *AuthController) Logout(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token != "" && len(token) > 7 && strings.HasPrefix(token, "Bearer ") {
		token = token[7:]
		h.authSvc.Logout(token)
	}
	OK(c, gin.H{})
}
