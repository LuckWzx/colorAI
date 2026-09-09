package database

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

// InitRedis 初始化 Redis 连接
func InitRedis() {
	addr := getEnv("REDIS_ADDR", "127.0.0.1:6379")
	pass := getEnv("REDIS_PASS", "")

	RDB = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: pass,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := RDB.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis 连接失败: %v", err)
	}
	log.Println("✓ Redis 连接成功")
}

// CloseRedis 关闭 Redis 连接
func CloseRedis() {
	if RDB != nil {
		RDB.Close()
	}
}
