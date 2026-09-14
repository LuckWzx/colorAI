package main

import (
	"log"
	"os"
	"path/filepath"

	"colorai-backend/config"
	"colorai-backend/controller"
	"colorai-backend/database"
	"colorai-backend/model/entity"
	"colorai-backend/repository"
	"colorai-backend/service"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// App 依赖注入容器，持有所有基础设施、仓库、服务和处理器引用
type App struct {
	// 基础设施
	Config *config.Config
	DB     *gorm.DB
	RDB    *redis.Client

	// Repositories
	UserRepo    repository.UserRepository
	SessionRepo repository.SessionRepository

	// Services
	AuthService    service.AuthService
	ChatService    service.ChatService
	SessionService service.SessionService
	ColorService   service.ColorService

	// Controllers
	AuthController    *controller.AuthController
	ChatController    *controller.ChatController
	SessionController *controller.SessionController
	UserController    *controller.UserController
}

// NewApp 按依赖顺序组装所有组件
func NewApp(cfg *config.Config) *App {
	// 基础设施
	db := database.InitMySQL(cfg.Database)
	rdb := database.InitRedis(cfg.Redis)

	// 数据库迁移
	if cfg.Database.AutoMigrate {
		log.Println("开启数据库自动迁移...")
		err := db.AutoMigrate(
			&entity.User{},
			&entity.ChatSession{},
			&entity.ChatMessageRecord{},
		)
		if err != nil {
			log.Fatalf("数据库迁移失败: %v", err)
		}
		log.Println("数据库迁移完成")
	}

	// Repositories
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)

	// Services
	authSvc := service.NewAuthService(userRepo, rdb)
	chatSvc := service.NewChatService(cfg.LLM, sessionRepo)
	sessionSvc := service.NewSessionService(sessionRepo)
	colorSvc := service.NewColorService()

	// Controllers
	authCtrl := controller.NewAuthController(authSvc)
	chatCtrl := controller.NewChatController(chatSvc)
	sessionCtrl := controller.NewSessionController(sessionSvc)
	userCtrl := controller.NewUserController()

	if err := os.MkdirAll(filepath.Join(".", "uploads"), 0755); err != nil {
		log.Printf("警告: 创建 uploads 目录失败: %v", err)
	}

	log.Println("所有组件初始化完成")

	return &App{
		Config:            cfg,
		DB:                db,
		RDB:               rdb,
		UserRepo:          userRepo,
		SessionRepo:       sessionRepo,
		AuthService:       authSvc,
		ChatService:       chatSvc,
		SessionService:    sessionSvc,
		ColorService:      colorSvc,
		AuthController:    authCtrl,
		ChatController:    chatCtrl,
		SessionController: sessionCtrl,
		UserController:    userCtrl,
	}
}

// Close 释放所有资源
func (a *App) Close() {
	if a.DB != nil {
		sqlDB, err := a.DB.DB()
		if err == nil {
			sqlDB.Close()
		}
	}
	if a.RDB != nil {
		a.RDB.Close()
	}
}
