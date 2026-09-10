package database

import (
	"context"
	"log"
	"time"

	"colorai-backend/config"

	"github.com/redis/go-redis/v9"
)

// InitRedis 初始化 Redis 连接，返回 *redis.Client
func InitRedis(cfg config.RedisConfig) *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Pass,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis 连接失败: %v", err)
	}
	log.Println("Redis 连接成功")
	return rdb
}
