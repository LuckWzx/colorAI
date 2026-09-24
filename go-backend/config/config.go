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
// 两个驱动：local（本地磁盘 + Gin 静态路由）与 oss（阿里云 OSS，bucket 公共读）。
// 调用方（chat_service.resolveImages）只依赖 Storage 接口，切换驱动不改调用方。
type StorageConfig struct {
	// Driver 存储驱动：local（默认）| oss
	Driver string
	// LocalDir 本地存储根目录，同时也是静态路由 /uploads 的映射目录。
	// Driver=oss 时不再写入，但路由仍保留以兼容切换前的历史图片 URL。
	LocalDir string
	// PublicBaseURL 图片对外访问的 URL 前缀。**两种驱动语义不同，切驱动必须同步改**：
	//   local → 站点基地址，最终 URL = PublicBaseURL + "/uploads/" + key
	//   oss   → bucket 的公网域名，最终 URL = PublicBaseURL + "/" + key
	// 典型值：http://localhost:3001（local）
	//         https://your-bucket.oss-cn-hangzhou.aliyuncs.com（oss）
	PublicBaseURL string
	// MaxUploadBytes 单张图片大小上限（字节）。base64 会膨胀约 1/3，
	// 请求体是 JSON，不设上限容易被一张巨图打爆内存。
	MaxUploadBytes int64

	// —— 以下四项仅在 Driver=oss 时生效 ——

	// OSSBucket bucket 名称
	OSSBucket string
	// OSSEndpoint 上传用的 endpoint。与对外访问域名是两回事：
	// ECS 与 bucket 同 region 时填**内网**域名（oss-cn-xxx-internal.aliyuncs.com），
	// 免公网流量费且延迟更低；本地开发必须填公网域名，否则连不通。
	OSSEndpoint string
	// OSSAccessKeyID / OSSAccessKeySecret 建议用 RAM 子账号，只授予该 bucket 的写权限，
	// 不要用主账号 AK（主账号 AK 一旦泄露等于整个账号失守）。
	OSSAccessKeyID     string
	OSSAccessKeySecret string
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

			OSSBucket:          getEnv("OSS_BUCKET", ""),
			OSSEndpoint:        getEnv("OSS_ENDPOINT", ""),
			OSSAccessKeyID:     getEnv("OSS_ACCESS_KEY_ID", ""),
			OSSAccessKeySecret: getEnv("OSS_ACCESS_KEY_SECRET", ""),
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
