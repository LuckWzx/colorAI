package config

import (
	"os"
	"strings"
)

// Config 应用全局配置
type Config struct {
	Port     string
	LLM      LLMConfig
	Database DatabaseConfig
	Redis    RedisConfig
	CORS     CORSConfig
}

// LLMConfig LLM 服务配置
type LLMConfig struct {
	APIKey     string
	APIURL     string
	Model      string
	MaxTokens  int
	TimeoutSec int
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
		Port: getEnv("PORT", "3001"),
		LLM: LLMConfig{
			APIKey:     os.Getenv("LLM_API_KEY"),
			APIURL:     getEnv("LLM_API_URL", "https://api.deepseek.com/v1/chat/completions"),
			Model:      getEnv("LLM_MODEL", "deepseek-v4-flash"),
			MaxTokens:  2000,
			TimeoutSec: 30,
		},
		Database: DatabaseConfig{
			Host:         getEnv("DB_HOST", "127.0.0.1"),
			Port:         getEnv("DB_PORT", "3306"),
			User:         getEnv("DB_USER", "agent"),
			Pass:         getEnv("DB_PASS", ""),
			Name:         getEnv("DB_NAME", "agent"),
			MaxOpenConns: 25,
			MaxIdleConns: 5,
		},
		Redis: RedisConfig{
			Addr: getEnv("REDIS_ADDR", "127.0.0.1:6379"),
			Pass: getEnv("REDIS_PASS", ""),
		},
		CORS: CORSConfig{
			Origins: parseOrigins(getEnv("CORS_ORIGINS", "")),
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
