package main

import (
	"fmt"
	"log"

	"colorai-backend/config"

	"github.com/joho/godotenv"
)

func main() {
	// 加载 .env 文件
	_ = godotenv.Load()

	// 加载配置
	cfg := config.Load()

	// 初始化所有组件（数据库 → 仓库 → 服务 → 控制器）
	app := NewApp(cfg)
	defer app.Close()

	// 注册路由
	r := SetupRouter(app)

	// 启动服务
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Go backend server ready on port %s", cfg.Port)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
