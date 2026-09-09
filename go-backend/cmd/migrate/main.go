package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

type QAItem struct {
	ID       string   `json:"id"`
	Question string   `json:"question"`
	Answer   string   `json:"answer"`
	Category string   `json:"category"`
	Tags     []string `json:"tags"`
	Level    int      `json:"level"`
}

type Shop struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Address  string   `json:"address"`
	City     string   `json:"city"`
	Phone    string   `json:"phone"`
	Products []string `json:"products"`
	Rating   float64  `json:"rating"`
}

type Brand struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Initial     string   `json:"initial"`
	Rating      float64  `json:"rating"`
	Category    []string `json:"category"`
	Description string   `json:"description"`
	Website     string   `json:"website"`
}

func main() {
	_ = godotenv.Load()

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=Local",
		getEnv("DB_USER", "agent"),
		getEnv("DB_PASS", "3ZhRGawBrYSRpCwF"),
		getEnv("DB_HOST", "39.106.186.3"),
		getEnv("DB_PORT", "3306"),
		getEnv("DB_NAME", "agent"),
	)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("数据库不可达: %v", err)
	}
	fmt.Println("✓ 数据库连接成功")

	dataDir := filepath.Join(".", "data")

	// 迁移 color_issues
	var colorIssues []QAItem
	loadJSON(filepath.Join(dataDir, "color_issues.json"), &colorIssues)
	for _, item := range colorIssues {
		tags, _ := json.Marshal(item.Tags)
		_, err := db.Exec("INSERT IGNORE INTO color_issues (id, question, answer, category, tags) VALUES (?, ?, ?, ?, ?)",
			item.ID, item.Question, item.Answer, item.Category, string(tags))
		if err != nil {
			log.Printf("color_issues 插入失败 %s: %v", item.ID, err)
		}
	}
	fmt.Printf("✓ color_issues: %d 条\n", len(colorIssues))

	// 迁移 photo_tips
	var photoTips []QAItem
	loadJSON(filepath.Join(dataDir, "photo_tips.json"), &photoTips)
	for _, item := range photoTips {
		tags, _ := json.Marshal(item.Tags)
		level := item.Level
		if level == 0 {
			level = 1
		}
		_, err := db.Exec("INSERT IGNORE INTO photo_tips (id, question, answer, category, tags, level) VALUES (?, ?, ?, ?, ?, ?)",
			item.ID, item.Question, item.Answer, item.Category, string(tags), level)
		if err != nil {
			log.Printf("photo_tips 插入失败 %s: %v", item.ID, err)
		}
	}
	fmt.Printf("✓ photo_tips: %d 条\n", len(photoTips))

	// 迁移 shops
	var shops []Shop
	loadJSON(filepath.Join(dataDir, "shops.json"), &shops)
	for _, s := range shops {
		products, _ := json.Marshal(s.Products)
		_, err := db.Exec("INSERT IGNORE INTO shops (id, name, address, city, phone, products, rating) VALUES (?, ?, ?, ?, ?, ?, ?)",
			s.ID, s.Name, s.Address, s.City, s.Phone, string(products), s.Rating)
		if err != nil {
			log.Printf("shops 插入失败 %s: %v", s.ID, err)
		}
	}
	fmt.Printf("✓ shops: %d 条\n", len(shops))

	// 迁移 brands
	var brands []Brand
	loadJSON(filepath.Join(dataDir, "brands.json"), &brands)
	for _, b := range brands {
		category, _ := json.Marshal(b.Category)
		_, err := db.Exec("INSERT IGNORE INTO brands (id, name, initial, rating, category, description, website) VALUES (?, ?, ?, ?, ?, ?, ?)",
			b.ID, b.Name, b.Initial, b.Rating, string(category), b.Description, b.Website)
		if err != nil {
			log.Printf("brands 插入失败 %s: %v", b.ID, err)
		}
	}
	fmt.Printf("✓ brands: %d 条\n", len(brands))

	fmt.Println("\n🎉 数据迁移完成!")
}

func loadJSON(path string, dest interface{}) {
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("读取 %s 失败: %v", path, err)
		return
	}
	if err := json.Unmarshal(data, dest); err != nil {
		log.Printf("解析 %s 失败: %v", path, err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
