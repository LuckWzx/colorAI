package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"colorai-backend/handlers"
	"colorai-backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 加载 .env 文件
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	// 确保 uploads 和 data 目录存在
	_ = os.MkdirAll("uploads", 0755)

	r := gin.Default()

	// 中间件
	r.Use(middleware.CORS())

	// 静态文件: 提供上传文件的访问
	r.Static("/uploads", filepath.Join(".", "uploads"))

	// 健康检查
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"success": true,
			"message": "ok",
		})
	})

	// 图片处理路由
	colorGroup := r.Group("/api/color")
	{
		colorGroup.POST("/correct", handlers.ColorCorrect)
		colorGroup.POST("/pick", handlers.ColorPick)
		colorGroup.POST("/compare", handlers.ColorCompare)
		colorGroup.POST("/phone-correct", handlers.ColorPhoneCorrect)
	}

	// 知识数据路由
	knowledgeGroup := r.Group("/api/knowledge")
	{
		knowledgeGroup.GET("/color-issues", handlers.KnowledgeColorIssues)
		knowledgeGroup.GET("/photo-tips", handlers.KnowledgePhotoTips)
		knowledgeGroup.GET("/shops", handlers.KnowledgeShops)
		knowledgeGroup.GET("/brands", handlers.KnowledgeBrands)
	}

	// DeepSeek AI 代理
	r.POST("/api/deepseek/chat", handlers.DeepseekChat)

	// 用户认证路由(桩函数)
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", handlers.AuthRegister)
		authGroup.POST("/login", handlers.AuthLogin)
		authGroup.POST("/logout", handlers.AuthLogout)
	}

	// 404 处理
	r.NoRoute(func(c *gin.Context) {
		c.JSON(404, gin.H{
			"success": false,
			"error":   "API not found",
		})
	})

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Go backend server ready on port %s", port)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
