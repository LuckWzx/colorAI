package main

import (
	"log"
	"os"

	"colorai-backend/config"
	"colorai-backend/controller"
	"colorai-backend/database"
	"colorai-backend/model/entity"
	"colorai-backend/pkg/storage"
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
	// 组装层负责把 config.StorageConfig 适配成 pkg/storage 自己的 Config ——
	// 这样 pkg/storage 不必 import colorai-backend/config，才能独立复用。
	store, err := storage.New(storage.Config{
		Driver:             storage.Driver(cfg.Storage.Driver),
		LocalDir:           cfg.Storage.LocalDir,
		PublicBaseURL:      cfg.Storage.PublicBaseURL,
		MaxUploadBytes:     cfg.Storage.MaxUploadBytes,
		OSSBucket:          cfg.Storage.OSSBucket,
		OSSEndpoint:        cfg.Storage.OSSEndpoint,
		OSSAccessKeyID:     cfg.Storage.OSSAccessKeyID,
		OSSAccessKeySecret: cfg.Storage.OSSAccessKeySecret,
	})
	if err != nil {
		// 配置缺失 / 驱动名非法就启动失败 —— 避免「服务起来了但每个文件都存不进去」
		// 这种报错点散落在 chat 链路里的状态。注意 bucket 名、AK 权限不在此列，
		// 那类错误要等首次上传才暴露。
		log.Fatalf("初始化文件存储失败: %v", err)
	}
	authSvc := service.NewAuthService(userRepo, rdb)
	chatSvc := service.NewChatService(sessionRepo, store, cfg.AgentURL)
	sessionSvc := service.NewSessionService(sessionRepo)

	// Controllers
	authCtrl := controller.NewAuthController(authSvc)
	chatCtrl := controller.NewChatController(chatSvc)
	sessionCtrl := controller.NewSessionController(sessionSvc)
	userCtrl := controller.NewUserController()

	// 只有 local 驱动需要落盘目录。oss 驱动不写本地盘，但 router.go 的 /uploads
	// 静态路由仍然保留 —— 用于兼容「切到 OSS 之前」已落库的历史图片 URL。
	if storage.Driver(cfg.Storage.Driver) != storage.DriverOSS {
		if err := os.MkdirAll(cfg.Storage.LocalDir, 0755); err != nil {
			log.Printf("警告: 创建图片存储目录 %s 失败: %v", cfg.Storage.LocalDir, err)
		}
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
