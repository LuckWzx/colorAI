package config

import (
	"os"
	"strconv"
	"strings"
)

// Config 应用全局配置
type Config struct {
	Port string
	// AgentURL Python 智能体服务的基地址（Go 通过它转发 /api/chat、探活 /health）
	// 注意：必须与 agent/.env 里 Python 实际监听的地址一致，否则转发会失败。
	AgentURL string
	Database DatabaseConfig
	Redis    RedisConfig
	CORS     CORSConfig
	Storage  StorageConfig
}

// StorageConfig 文件存储配置
//
// 目前只有 local 驱动（存本地磁盘）。后期接入阿里云 OSS 时：
//  1. 在 service 包新增一个 Storage 实现
//  2. 这里加 OSS 相关字段（Bucket / Endpoint / AccessKey…）
//  3. PUBLIC_BASE_URL 改成 bucket 域名
//
// 调用方（chat_service）不需要任何改动。
type StorageConfig struct {
	// Driver 存储驱动：local（默认）
	Driver string
	// LocalDir 本地存储根目录，同时也是静态路由 /uploads 的映射目录
	LocalDir string
	// PublicBaseURL 访问 URL 的前缀。**切 OSS 时只改这一个值**
	PublicBaseURL string
	// MaxUploadBytes 单张图片大小上限（字节）。base64 会膨胀约 1/3，
	// 请求体是 JSON，不设上限容易被一张巨图打爆内存。
	MaxUploadBytes int64
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host         string
	Port         string
	User         string
	Pass         string
	Name         string
	MaxOpenConns int
	MaxIdleConns int
	AutoMigrate  bool
}

// RedisConfig Redis 配置
type RedisConfig struct {
	Addr string
	Pass string
}

// CORSConfig 跨域配置
type CORSConfig struct {
	Origins []string
}

// Load 从环境变量加载配置
func Load() *Config {
	cfg := &Config{
		Port:     getEnv("PORT", "3001"),
		AgentURL: strings.TrimRight(getEnv("AGENT_URL", "http://localhost:8000"), "/"),
		Database: DatabaseConfig{
			Host:         getEnv("DB_HOST", "127.0.0.1"),
			Port:         getEnv("DB_PORT", "3306"),
			User:         getEnv("DB_USER", "agent"),
			Pass:         getEnv("DB_PASS", ""),
			Name:         getEnv("DB_NAME", "agent"),
			MaxOpenConns: 25,
			MaxIdleConns: 5,
			AutoMigrate:  getEnv("DB_AUTO_MIGRATE", "false") == "true",
		},
		Redis: RedisConfig{
			Addr: getEnv("REDIS_ADDR", "127.0.0.1:6379"),
			Pass: getEnv("REDIS_PASS", ""),
		},
		CORS: CORSConfig{
			Origins: parseOrigins(getEnv("CORS_ORIGINS", "")),
		},
		Storage: StorageConfig{
			Driver:         getEnv("STORAGE_DRIVER", "local"),
			LocalDir:       getEnv("UPLOADS_DIR", "uploads"),
			PublicBaseURL:  strings.TrimRight(getEnv("PUBLIC_BASE_URL", "http://localhost:3001"), "/"),
			MaxUploadBytes: getEnvInt64("MAX_UPLOAD_BYTES", 10*1024*1024), // 10MB
		},
	}

	// 默认 CORS 来源
	if len(cfg.CORS.Origins) == 0 {
		cfg.CORS.Origins = []string{
			"http://localhost:5173",
			"http://localhost:3001",
		}
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}

func parseOrigins(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
