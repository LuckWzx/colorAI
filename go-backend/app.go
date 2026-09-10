package main

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	"colorai-backend/config"
	"colorai-backend/controller"
	"colorai-backend/database"
	"colorai-backend/repository"
	"colorai-backend/service"

	"github.com/redis/go-redis/v9"
)

// App 依赖注入容器，持有所有基础设施、仓库、服务和处理器引用
type App struct {
	// 基础设施
	Config *config.Config
	DB     *sql.DB
	RDB    *redis.Client

	// Repositories
	UserRepo      repository.UserRepository
	SessionRepo   repository.SessionRepository
	KnowledgeRepo repository.KnowledgeRepository

	// Services
	AuthService      service.AuthService
	ChatService      service.ChatService
	ColorService     service.ColorService
	SessionService   service.SessionService
	KnowledgeService service.KnowledgeService

	// Controllers
	AuthController      *controller.AuthController
	ChatController      *controller.ChatController
	ColorController     *controller.ColorController
	SessionController   *controller.SessionController
	KnowledgeController *controller.KnowledgeController
	UserController      *controller.UserController
}

// NewApp 按依赖顺序组装所有组件
func NewApp(cfg *config.Config) *App {
	// 基础设施
	db := database.InitMySQL(cfg.Database)
	rdb := database.InitRedis(cfg.Redis)

	// Repositories
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	knowledgeRepo := repository.NewKnowledgeRepository(db)

	// Services
	authSvc := service.NewAuthService(userRepo, rdb)
	chatSvc := service.NewChatService(cfg.LLM)
	colorSvc := service.NewColorService()
	sessionSvc := service.NewSessionService(sessionRepo)
	knowledgeSvc := service.NewKnowledgeService(knowledgeRepo)

	// Controllers
	authCtrl := controller.NewAuthController(authSvc)
	chatCtrl := controller.NewChatController(chatSvc)
	colorCtrl := controller.NewColorController(colorSvc)
	sessionCtrl := controller.NewSessionController(sessionSvc)
	knowledgeCtrl := controller.NewKnowledgeController(knowledgeSvc)
	userCtrl := controller.NewUserController()

	if err := os.MkdirAll(filepath.Join(".", "uploads"), 0755); err != nil {
		log.Printf("警告: 创建 uploads 目录失败: %v", err)
	}

	log.Println("所有组件初始化完成")

	return &App{
		Config:              cfg,
		DB:                  db,
		RDB:                 rdb,
		UserRepo:            userRepo,
		SessionRepo:         sessionRepo,
		KnowledgeRepo:       knowledgeRepo,
		AuthService:         authSvc,
		ChatService:         chatSvc,
		ColorService:        colorSvc,
		SessionService:      sessionSvc,
		KnowledgeService:    knowledgeSvc,
		AuthController:      authCtrl,
		ChatController:      chatCtrl,
		ColorController:     colorCtrl,
		SessionController:   sessionCtrl,
		KnowledgeController: knowledgeCtrl,
		UserController:      userCtrl,
	}
}

// Close 释放所有资源
func (a *App) Close() {
	if a.DB != nil {
		a.DB.Close()
	}
	if a.RDB != nil {
		a.RDB.Close()
	}
}
