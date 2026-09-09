package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

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

	// ============================================================
	// 会话系统：建表 + 写入初始数据
	// ============================================================
	migrateChatSessions(db)
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

// migrateChatSessions 会话系统迁移：拆分 messages 为独立表
func migrateChatSessions(db *sql.DB) {
	// 1. 重建 chat_sessions（去掉 JSON 列）
	_, _ = db.Exec("DROP TABLE IF EXISTS chat_messages")
	_, _ = db.Exec("DROP TABLE IF EXISTS chat_sessions")

	_, err := db.Exec(`
	CREATE TABLE chat_sessions (
	  id VARCHAR(64) PRIMARY KEY,
	  user_id VARCHAR(64) NOT NULL,
	  title VARCHAR(255) NOT NULL DEFAULT '新对话',
	  message_count INT NOT NULL DEFAULT 0,
	  created_at BIGINT NOT NULL,
	  updated_at BIGINT NOT NULL,
	  INDEX idx_user_updated (user_id, updated_at DESC)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
	`)
	if err != nil {
		log.Fatalf("创建 chat_sessions 表失败: %v", err)
	}
	fmt.Println("✓ chat_sessions 表已创建")

	// 2. 创建 chat_messages
	_, err = db.Exec(`
	CREATE TABLE chat_messages (
	  id VARCHAR(64) PRIMARY KEY,
	  session_id VARCHAR(64) NOT NULL,
	  role VARCHAR(16) NOT NULL,
	  msg_type VARCHAR(32) NOT NULL DEFAULT 'text',
	  content TEXT,
	  payload JSON,
	  sort_order INT NOT NULL DEFAULT 0,
	  created_at BIGINT NOT NULL,
	  INDEX idx_session_sort (session_id, sort_order)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
	`)
	if err != nil {
		log.Fatalf("创建 chat_messages 表失败: %v", err)
	}
	fmt.Println("✓ chat_messages 表已创建")

	// 3. 查找或创建用户
	phone := "19511035073"
	var userID string
	err = db.QueryRow("SELECT id FROM users WHERE phone = ?", phone).Scan(&userID)
	if err == sql.ErrNoRows {
		passwordHash := fmt.Sprintf("%x", sha256Sum([]byte("123456")))
		userID = fmt.Sprintf("u_%d", time.Now().UnixNano())
		_, err = db.Exec(
			"INSERT INTO users (id, username, phone, password_hash) VALUES (?, ?, ?, ?)",
			userID, "曲泉用户", phone, passwordHash)
		if err != nil {
			log.Fatalf("创建用户失败: %v", err)
		}
		fmt.Printf("✓ 用户已创建: %s (%s)\n", userID, phone)
	} else if err != nil {
		log.Fatalf("查询用户失败: %v", err)
	} else {
		fmt.Printf("✓ 用户已存在: %s (%s)\n", userID, phone)
	}

	// 4. 写入 mock 会话 + 消息
	now := time.Now().UnixMilli()
	type mockSession struct {
		id       string
		title    string
		created  int64
		updated  int64
		messages []map[string]interface{}
	}

	mockData := []mockSession{
		{
			id: "mock-session-001", title: "照片偏黄怎么校正？",
			created: now - 86400000*3, updated: now - 3600000,
			messages: []map[string]interface{}{
				{"id": "m1-1", "role": "user", "createdAt": now - 86400000*3, "text": "我的照片拍出来总是偏黄，有什么办法可以校正吗？"},
				{"id": "m1-2", "role": "assistant", "type": "text", "createdAt": now - 86400000*3 + 1000, "text": "照片偏黄通常是白平衡设置不准确导致的。建议：\n\n1. **手动调整白平衡**：在相机中将白平衡设为「阴天」或手动设置色温（约 5500K）\n2. **使用曲泉AI 一键校色**：上传图片后选择「AI 校色」模式，系统会自动识别并校正色温\n3. **后期微调**：在 HSL 面板中降低黄色饱和度 -10~-15\n\n你可以上传一张偏黄的照片，我来帮你分析具体的校正方案。"},
				{"id": "m1-3", "role": "user", "createdAt": now - 86400000*3 + 2000, "text": "用 AI 校色之后效果还不错，但是肤色有点偏红怎么办？", "feature": "correct"},
				{"id": "m1-4", "role": "assistant", "type": "text", "createdAt": now - 86400000*3 + 3000, "text": "校色后肤色偏红是常见问题，因为自动校色可能过度补偿了暖色调。建议：\n\n1. **单独调整橙色通道**：在 HSL 面板中降低橙色饱和度 -5~-10\n2. **微调色温**：在色温滑块上稍微往冷色方向移动\n3. **使用曲泉AI「智能取色」**：点击肤色区域查看具体色值，针对性调整\n\n需要我帮你进一步分析吗？"},
			},
		},
		{
			id: "mock-session-002", title: "HEX 转 CMYK 色值转换",
			created: now - 86400000*1, updated: now - 7200000,
			messages: []map[string]interface{}{
				{"id": "m2-1", "role": "user", "createdAt": now - 86400000, "text": "我想把 #FF6B35 这个颜色转换成 CMYK，用于印刷", "feature": "convert"},
				{"id": "m2-2", "role": "assistant", "type": "convert", "createdAt": now - 86400000 + 1000, "text": "色彩空间转换结果如下：", "convertResult": map[string]interface{}{"input": "#FF6B35", "detectedFormat": "hex", "color": map[string]interface{}{"hex": "#FF6B35", "rgb": map[string]int{"r": 255, "g": 107, "b": 53}, "hsl": map[string]int{"h": 17, "s": 100, "l": 60}, "cmyk": map[string]int{"c": 0, "m": 58, "y": 79, "k": 0}, "lab": map[string]float64{"l": 60.32, "a": 36.14, "b": 45.72}, "hsv": map[string]int{"h": 17, "s": 79, "v": 100}}, "colorName": "活力橙"}},
				{"id": "m2-3", "role": "user", "createdAt": now - 86400000 + 3000, "text": "CMYK 值是多少？印刷时需要注意什么？"},
				{"id": "m2-4", "role": "assistant", "type": "text", "createdAt": now - 86400000 + 4000, "text": "转换结果：**CMYK(0, 58, 79, 0)**\n\n印刷注意事项：\n\n1. **色域差异**：RGB 色域比 CMYK 大，部分鲜艳颜色在印刷时会变暗\n2. **ICC Profile**：建议使用 GRACoL 或 SWOP 标准 ICC 配置文件\n3. **打样验证**：正式印刷前务必进行数码打样\n4. **油墨密度**：确保印刷机的油墨密度在标准范围内\n\n这个橙色在 CMYK 下色域覆盖良好，印刷效果应该不错。"},
			},
		},
		{
			id: "mock-session-003", title: "两张图片颜色对比",
			created: now - 86400000*5, updated: now - 86400000*2,
			messages: []map[string]interface{}{
				{"id": "m3-1", "role": "user", "createdAt": now - 86400000*5, "text": "帮我对比这两张图的颜色差异", "feature": "compare"},
				{"id": "m3-2", "role": "assistant", "type": "compare", "createdAt": now - 86400000*5 + 1000, "text": "颜色对比分析完成：", "compareResult": map[string]interface{}{"similarity": 87.5, "deltaE": 3.2, "imageA": map[string]interface{}{"imageUrl": "/uploads/sample-a.jpg", "dominantColors": []map[string]interface{}{{"hex": "#E4572E", "ratio": 0.45}, {"hex": "#F4A261", "ratio": 0.30}, {"hex": "#264653", "ratio": 0.25}}}, "imageB": map[string]interface{}{"imageUrl": "/uploads/sample-b.jpg", "dominantColors": []map[string]interface{}{{"hex": "#E76F51", "ratio": 0.40}, {"hex": "#F4A261", "ratio": 0.35}, {"hex": "#2A9D8F", "ratio": 0.25}}}}},
			},
		},
	}

	for _, s := range mockData {
		// 插入会话元数据
		_, err := db.Exec(
			"INSERT INTO chat_sessions (id, user_id, title, message_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			s.id, userID, s.title, len(s.messages), s.created, s.updated)
		if err != nil {
			log.Printf("插入会话 %s 失败: %v", s.id, err)
			continue
		}

		// 逐条插入消息
		for order, msg := range s.messages {
			msgID, _ := msg["id"].(string)
			role, _ := msg["role"].(string)
			msgType, _ := msg["type"].(string)
			if msgType == "" {
				msgType = "text"
			}
			text, _ := msg["text"].(string)
			createdAt, _ := msg["createdAt"].(int64)

			// 把除 id/role/type/text/createdAt 外的字段放进 payload
			payload := map[string]interface{}{}
			for k, v := range msg {
				if k != "id" && k != "role" && k != "type" && k != "text" && k != "createdAt" {
					payload[k] = v
				}
			}
			payloadJSON, _ := json.Marshal(payload)
			if len(payload) == 0 {
				payloadJSON = []byte("null")
			}

			_, err := db.Exec(
				"INSERT INTO chat_messages (id, session_id, role, msg_type, content, payload, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				msgID, s.id, role, msgType, text, string(payloadJSON), order, createdAt)
			if err != nil {
				log.Printf("  插入消息 %s 失败: %v", msgID, err)
			}
		}
		fmt.Printf("  ✓ %s (%s, %d 条消息)\n", s.title, s.id, len(s.messages))
	}
	fmt.Println("✓ mock 会话数据已写入")
}

func sha256Sum(data []byte) []byte {
	h := sha256.Sum256(data)
	return h[:]
}
