package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"sort"
	"sync"
	"time"

	"colorai-backend/models"

	"github.com/gin-gonic/gin"
)

// ============================================================
// 内存会话存储（Mock 数据 + CRUD）
// 后续可替换为 MySQL 持久化实现
// ============================================================

type sessionEntry struct {
	detail models.ChatSessionDetail
}

var (
	sessionsMu sync.RWMutex
	sessionsDB = map[string]*sessionEntry{} // key: session ID
)

// initMockSessions 初始化 Mock 数据（首次加载时注入 3 个示例会话）
func initMockSessions() {
	now := time.Now().UnixMilli()

	mockSessions := []models.ChatSessionDetail{
		{
			ChatSession: models.ChatSession{
				ID:           "mock-session-001",
				Title:        "照片偏黄怎么校正？",
				CreatedAt:    now - 86400000*3, // 3 天前
				UpdatedAt:    now - 3600000,    // 1 小时前
				MessageCount: 4,
			},
			Messages: []map[string]interface{}{
				{
					"id": "m1-1", "role": "user", "createdAt": now - 86400000*3,
					"text": "我的照片拍出来总是偏黄，有什么办法可以校正吗？",
				},
				{
					"id": "m1-2", "role": "assistant", "type": "text", "createdAt": now - 86400000*3 + 1000,
					"text": "照片偏黄通常是白平衡设置不准确导致的。建议：\n\n1. **手动调整白平衡**：在相机中将白平衡设为「阴天」或手动设置色温（约 5500K）\n2. **使用曲泉AI 一键校色**：上传图片后选择「AI 校色」模式，系统会自动识别并校正色温\n3. **后期微调**：在 HSL 面板中降低黄色饱和度 -10~-15\n\n你可以上传一张偏黄的照片，我来帮你分析具体的校正方案。",
				},
				{
					"id": "m1-3", "role": "user", "createdAt": now - 86400000*3 + 2000,
					"text":    "用 AI 校色之后效果还不错，但是肤色有点偏红怎么办？",
					"feature": "correct",
				},
				{
					"id": "m1-4", "role": "assistant", "type": "text", "createdAt": now - 86400000*3 + 3000,
					"text": "校色后肤色偏红是常见问题，因为自动校色可能过度补偿了暖色调。建议：\n\n1. **单独调整橙色通道**：在 HSL 面板中降低橙色饱和度 -5~-10\n2. **微调色温**：在色温滑块上稍微往冷色方向移动\n3. **使用曲泉AI「智能取色」**：点击肤色区域查看具体色值，针对性调整\n\n需要我帮你进一步分析吗？",
				},
			},
			History: []map[string]string{
				{"role": "user", "content": "我的照片拍出来总是偏黄，有什么办法可以校正吗？"},
				{"role": "assistant", "content": "照片偏黄通常是白平衡设置不准确导致的..."},
				{"role": "user", "content": "用 AI 校色之后效果还不错，但是肤色有点偏红怎么办？"},
				{"role": "assistant", "content": "校色后肤色偏红是常见问题..."},
			},
		},
		{
			ChatSession: models.ChatSession{
				ID:           "mock-session-002",
				Title:        "HEX 转 CMYK 色值转换",
				CreatedAt:    now - 86400000*1, // 1 天前
				UpdatedAt:    now - 7200000,    // 2 小时前
				MessageCount: 3,
			},
			Messages: []map[string]interface{}{
				{
					"id": "m2-1", "role": "user", "createdAt": now - 86400000,
					"text":    "我想把 #FF6B35 这个颜色转换成 CMYK，用于印刷",
					"feature": "convert",
				},
				{
					"id": "m2-2", "role": "assistant", "type": "convert", "createdAt": now - 86400000 + 1000,
					"text": "色彩空间转换结果如下：",
					"convertResult": map[string]interface{}{
						"input":          "#FF6B35",
						"detectedFormat": "hex",
						"color": map[string]interface{}{
							"hex":  "#FF6B35",
							"rgb":  map[string]int{"r": 255, "g": 107, "b": 53},
							"hsl":  map[string]int{"h": 17, "s": 100, "l": 60},
							"cmyk": map[string]int{"c": 0, "m": 58, "y": 79, "k": 0},
							"lab":  map[string]float64{"l": 60.32, "a": 36.14, "b": 45.72},
							"hsv":  map[string]int{"h": 17, "s": 79, "v": 100},
						},
						"colorName": "活力橙",
					},
				},
				{
					"id": "m2-3", "role": "user", "createdAt": now - 86400000 + 3000,
					"text": "CMYK 值是多少？印刷时需要注意什么？",
				},
				{
					"id": "m2-4", "role": "assistant", "type": "text", "createdAt": now - 86400000 + 4000,
					"text": "转换结果：**CMYK(0, 58, 79, 0)**\n\n印刷注意事项：\n\n1. **色域差异**：RGB 色域比 CMYK 大，部分鲜艳颜色在印刷时会变暗\n2. **ICC Profile**：建议使用 GRACoL 或 SWOP 标准 ICC 配置文件\n3. **打样验证**：正式印刷前务必进行数码打样\n4. **油墨密度**：确保印刷机的油墨密度在标准范围内\n\n这个橙色在 CMYK 下色域覆盖良好，印刷效果应该不错。",
				},
			},
			History: []map[string]string{
				{"role": "user", "content": "我想把 #FF6B35 这个颜色转换成 CMYK，用于印刷"},
				{"role": "assistant", "content": "色彩空间转换结果如下：..."},
			},
		},
		{
			ChatSession: models.ChatSession{
				ID:           "mock-session-003",
				Title:        "两张图片颜色对比",
				CreatedAt:    now - 86400000*5, // 5 天前
				UpdatedAt:    now - 86400000*2, // 2 天前
				MessageCount: 2,
			},
			Messages: []map[string]interface{}{
				{
					"id": "m3-1", "role": "user", "createdAt": now - 86400000*5,
					"text":    "帮我对比这两张图的颜色差异",
					"feature": "compare",
				},
				{
					"id": "m3-2", "role": "assistant", "type": "compare", "createdAt": now - 86400000*5 + 1000,
					"text": "颜色对比分析完成：",
					"compareResult": map[string]interface{}{
						"similarity": 87.5,
						"deltaE":     3.2,
						"imageA": map[string]interface{}{
							"imageUrl": "/uploads/sample-a.jpg",
							"dominantColors": []map[string]interface{}{
								{"hex": "#E4572E", "ratio": 0.45},
								{"hex": "#F4A261", "ratio": 0.30},
								{"hex": "#264653", "ratio": 0.25},
							},
						},
						"imageB": map[string]interface{}{
							"imageUrl": "/uploads/sample-b.jpg",
							"dominantColors": []map[string]interface{}{
								{"hex": "#E76F51", "ratio": 0.40},
								{"hex": "#F4A261", "ratio": 0.35},
								{"hex": "#2A9D8F", "ratio": 0.25},
							},
						},
					},
				},
			},
			History: []map[string]string{
				{"role": "user", "content": "帮我对比这两张图的颜色差异"},
				{"role": "assistant", "content": "颜色对比分析完成：相似度 87.5%，ΔE=3.2"},
			},
		},
	}

	sessionsMu.Lock()
	for i := range mockSessions {
		s := &mockSessions[i]
		sessionsDB[s.ID] = &sessionEntry{detail: *s}
	}
	sessionsMu.Unlock()
}

// 模块初始化时注入 Mock 数据
func init() {
	initMockSessions()
}

// ============================================================
// API Handlers
// ============================================================

// ListSessions 获取会话列表（按 updatedAt 倒序，不含 messages/history）
// GET /api/sessions
func ListSessions(c *gin.Context) {
	sessionsMu.RLock()
	defer sessionsMu.RUnlock()

	list := make([]models.ChatSession, 0, len(sessionsDB))
	for _, e := range sessionsDB {
		list = append(list, e.detail.ChatSession)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].UpdatedAt > list[j].UpdatedAt
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"items":   list,
		"total":   len(list),
	})
}

// GetSession 获取单个会话详情（含 messages/history）
// GET /api/sessions/:id
func GetSession(c *gin.Context) {
	id := c.Param("id")

	sessionsMu.RLock()
	e, ok := sessionsDB[id]
	sessionsMu.RUnlock()

	if !ok {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Success: false,
			Error:   "Session not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"session": e.detail,
	})
}

// SaveSession 全量保存会话（upsert：同 id 覆盖，保留原 createdAt）
// PUT /api/sessions/:id
func SaveSession(c *gin.Context) {
	id := c.Param("id")

	var req models.SaveSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success: false,
			Error:   "Invalid request body",
		})
		return
	}

	now := time.Now().UnixMilli()
	title := req.Title
	if title == "" {
		title = "新对话"
	}

	sessionsMu.Lock()
	existed, exists := sessionsDB[id]

	// 计算消息数量
	msgCount := 0
	if msgs, ok := req.Messages.([]interface{}); ok {
		msgCount = len(msgs)
	}

	detail := models.ChatSessionDetail{
		ChatSession: models.ChatSession{
			ID:           id,
			Title:        title,
			CreatedAt:    now, // 新建时设为当前时间
			UpdatedAt:    now,
			MessageCount: msgCount,
		},
		Messages: req.Messages,
		History:  req.History,
	}

	if exists {
		detail.CreatedAt = existed.detail.CreatedAt // 保留原创建时间
	}

	sessionsDB[id] = &sessionEntry{detail: detail}
	sessionsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"session": detail,
	})
}

// DeleteSession 删除会话
// DELETE /api/sessions/:id
func DeleteSession(c *gin.Context) {
	id := c.Param("id")

	sessionsMu.Lock()
	_, exists := sessionsDB[id]
	if exists {
		delete(sessionsDB, id)
	}
	sessionsMu.Unlock()

	if !exists {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Success: false,
			Error:   "Session not found",
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Success: true})
}

// CreateSession 新建空会话（返回预生成 ID，前端可立即使用）
// POST /api/sessions
func CreateSession(c *gin.Context) {
	id := fmt.Sprintf("session-%08x", rand.Int63n(0xFFFFFFFF))
	now := time.Now().UnixMilli()

	detail := models.ChatSessionDetail{
		ChatSession: models.ChatSession{
			ID:           id,
			Title:        "新对话",
			CreatedAt:    now,
			UpdatedAt:    now,
			MessageCount: 0,
		},
		Messages: []interface{}{},
		History:  []interface{}{},
	}

	sessionsMu.Lock()
	sessionsDB[id] = &sessionEntry{detail: detail}
	sessionsMu.Unlock()

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"session": detail,
	})
}
