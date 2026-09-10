package database

import (
	"database/sql"
	"fmt"
	"log"

	"colorai-backend/config"

	_ "github.com/go-sql-driver/mysql"
)

// InitMySQL 初始化 MySQL 连接，返回 *sql.DB
func InitMySQL(cfg config.DatabaseConfig) *sql.DB {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=Local",
		cfg.User, cfg.Pass, cfg.Host, cfg.Port, cfg.Name)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	if err := db.Ping(); err != nil {
		log.Fatalf("数据库不可达: %v", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)

	log.Println("数据库连接成功")
	return db
}
