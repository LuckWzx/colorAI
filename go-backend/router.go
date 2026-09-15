package main

import (
	"path/filepath"

	"colorai-backend/controller"
	"colorai-backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRouter 初始化 Gin 引擎并注册所有路由，返回引擎实例
func SetupRouter(app *App) *gin.Engine {
	r := gin.Default()

	// 中间件
	r.Use(middleware.CORS(app.Config.CORS.Origins))

	// 静态文件：提供上传文件的访问
	r.Static("/uploads", filepath.Join(".", "uploads"))

	// 健康检查
	r.GET("/api/health", controller.Health)

	// 认证路由（公开）
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", app.AuthController.Register)
		authGroup.POST("/login", app.AuthController.Login)
		authGroup.POST("/logout", app.AuthController.Logout)
	}

	// 会话管理路由（需要登录）
	sessionGroup := r.Group("/api/sessions", middleware.RequireAuth(app.AuthService))
	{
		sessionGroup.GET("", app.SessionController.ListSessions)
		sessionGroup.POST("", app.SessionController.CreateSession)
		sessionGroup.GET("/:id", app.SessionController.GetSession)
		sessionGroup.DELETE("/:id", app.SessionController.DeleteSession)
	}

	// AI 对话代理（需要登录）
	r.POST("/api/chat", middleware.RequireAuth(app.AuthService), app.ChatController.Chat)

	// 用户信息路由（需要登录）
	userGroup := r.Group("/api/user", middleware.RequireAuth(app.AuthService))
	{
		userGroup.GET("/profile", app.UserController.UserProfile)
	}

	// 404 处理
	r.NoRoute(func(c *gin.Context) {
		c.JSON(404, gin.H{
			"success": false,
			"error":   "API not found",
		})
	})

	return r
}
