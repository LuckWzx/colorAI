package main

import (
	"colorai-backend/controller"
	"colorai-backend/middleware"
	"colorai-backend/pkg/storage"

	"github.com/gin-gonic/gin"
)

// SetupRouter 初始化 Gin 引擎并注册所有路由，返回引擎实例
func SetupRouter(app *App) *gin.Engine {
	r := gin.Default()

	// 中间件
	r.Use(middleware.CORS(app.Config.CORS.Origins))

	// 静态文件：提供上传文件的访问（仅 local 驱动需要；oss 驱动下这里指向一个空目录，
	// 保留它是为了兼容「切到 OSS 之前」已落库的历史图片 URL）。
	// 目录取自 config.Storage.LocalDir，前缀用 pkg/storage 导出的 UploadURLPrefix ——
	// 两边共用同一个常量，避免各自硬编码导致 URL 拼出来打不开。
	r.Static(storage.UploadURLPrefix, app.Config.Storage.LocalDir)

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
