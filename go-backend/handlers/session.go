package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"time"

	"colorai-backend/database"
	"colorai-backend/models"

	"github.com/gin-gonic/gin"
)

// ============================================================
// 辅助
// ============================================================

func getUserID(c *gin.Context) string {
	return c.GetString("user_id")
}

func genID() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
	return fmt.Sprintf("msg-%016x", n.Int64())
}

// ============================================================
// ListSessions — 只查会话元数据
// GET /api/sessions
// ============================================================

func ListSessions(c *gin.Context) {
	userID := getUserID(c)

	rows, err := database.DB.Query(
		"SELECT id, title, created_at, updated_at, message_count FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "查询会话失败"})
		return
	}
	defer rows.Close()

	list := make([]models.ChatSession, 0)
	for rows.Next() {
		var s models.ChatSession
		if err := rows.Scan(&s.ID, &s.Title, &s.CreatedAt, &s.UpdatedAt, &s.MessageCount); err != nil {
			continue
		}
		list = append(list, s)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "items": list, "total": len(list)})
}

// ============================================================
// GetSession — 会话详情，消息从 chat_messages 表按 sort_order 加载
// GET /api/sessions/:id
// ============================================================

func GetSession(c *gin.Context) {
	userID := getUserID(c)
	id := c.Param("id")

	// 1. 查会话元数据
	var detail models.ChatSessionDetail
	err := database.DB.QueryRow(
		"SELECT id, title, created_at, updated_at, message_count FROM chat_sessions WHERE id = ? AND user_id = ?",
		id, userID,
	).Scan(&detail.ID, &detail.Title, &detail.CreatedAt, &detail.UpdatedAt, &detail.MessageCount)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Success: false, Error: "Session not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "查询会话失败"})
		return
	}

	// 2. 查消息列表
	msgs, hist, err := loadMessages(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "查询消息失败"})
		return
	}
	detail.Messages = msgs
	detail.History = hist

	c.JSON(http.StatusOK, gin.H{"success": true, "session": detail})
}

// loadMessages 从 chat_messages 表加载消息，返回 messages + history（AI 对话上下文）
func loadMessages(sessionID string) (messages []interface{}, history []interface{}, err error) {
	rows, err := database.DB.Query(
		"SELECT id, role, msg_type, content, payload, created_at FROM chat_messages WHERE session_id = ? ORDER BY sort_order",
		sessionID,
	)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	messages = make([]interface{}, 0)
	history = make([]interface{}, 0)

	for rows.Next() {
		var (
			msgID, role, msgType string
			content              string
			payloadStr           sql.NullString
			createdAt            int64
		)
		if err := rows.Scan(&msgID, &role, &msgType, &content, &payloadStr, &createdAt); err != nil {
			continue
		}

		// 构建前端 Message 对象
		msg := map[string]interface{}{
			"id":        msgID,
			"role":      role,
			"type":      msgType,
			"createdAt": createdAt,
		}
		if content != "" {
			msg["text"] = content
		}

		// payload 解包（correctResult / compareResult / convertResult 等）
		if payloadStr.Valid && payloadStr.String != "" && payloadStr.String != "null" {
			var payload map[string]interface{}
			if json.Unmarshal([]byte(payloadStr.String), &payload) == nil {
				for k, v := range payload {
					msg[k] = v
				}
			}
		}

		messages = append(messages, msg)

		// 构建 history（LLM API 格式：只保留 user 文字 + assistant 文字）
		if content != "" {
			history = append(history, map[string]string{"role": role, "content": content})
		}
	}
	return messages, history, nil
}

// ============================================================
// SaveSession — 全量保存（删除旧消息 → 批量插入新消息）
// PUT /api/sessions/:id
// ============================================================

func SaveSession(c *gin.Context) {
	userID := getUserID(c)
	id := c.Param("id")

	var req models.SaveSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Success: false, Error: "Invalid request body"})
		return
	}

	now := time.Now().UnixMilli()
	title := req.Title
	if title == "" {
		title = "新对话"
	}

	msgCount := 0
	if msgs, ok := req.Messages.([]interface{}); ok {
		msgCount = len(msgs)
	}

	// 事务：更新会话 → 删除旧消息 → 插入新消息
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "事务开始失败"})
		return
	}
	defer tx.Rollback()

	// upsert 会话元数据
	var sessionCreatedAt int64
	err = tx.QueryRow("SELECT created_at FROM chat_sessions WHERE id = ? AND user_id = ?", id, userID).Scan(&sessionCreatedAt)

	if err == nil {
		// 已存在 → 更新
		_, err = tx.Exec("UPDATE chat_sessions SET title = ?, message_count = ?, updated_at = ? WHERE id = ? AND user_id = ?",
			title, msgCount, now, id, userID)
	} else {
		// 不存在 → 插入
		sessionCreatedAt = now
		_, err = tx.Exec("INSERT INTO chat_sessions (id, user_id, title, message_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			id, userID, title, msgCount, now, now)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "保存会话失败"})
		return
	}

	// 删除旧消息
	tx.Exec("DELETE FROM chat_messages WHERE session_id = ?", id)

	// 批量插入新消息
	if msgs, ok := req.Messages.([]interface{}); ok {
		stmt, err := tx.Prepare(
			"INSERT INTO chat_messages (id, session_id, role, msg_type, content, payload, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "准备插入消息失败"})
			return
		}
		defer stmt.Close()

		for order, raw := range msgs {
			m, ok := raw.(map[string]interface{})
			if !ok {
				continue
			}
			msgID, _ := m["id"].(string)
			if msgID == "" {
				msgID = genID()
			}
			role, _ := m["role"].(string)
			msgType, _ := m["type"].(string)
			if msgType == "" {
				msgType = "text"
			}
			text, _ := m["text"].(string)
			msgCreatedAt, _ := m["createdAt"].(float64) // JSON number → float64

			// 把额外字段打包为 payload
			payload := map[string]interface{}{}
			for k, v := range m {
				if k != "id" && k != "role" && k != "type" && k != "text" && k != "createdAt" {
					payload[k] = v
				}
			}
			payloadJSON, _ := json.Marshal(payload)
			if len(payload) == 0 {
				payloadJSON = []byte("null")
			}

			if _, execErr := stmt.Exec(msgID, id, role, msgType, text, string(payloadJSON), order, int64(msgCreatedAt)); execErr != nil {
				log.Printf("插入消息 %s 失败: %v", msgID, execErr)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"session": models.ChatSessionDetail{
			ChatSession: models.ChatSession{ID: id, Title: title, CreatedAt: sessionCreatedAt, UpdatedAt: now, MessageCount: msgCount},
			Messages:    req.Messages,
			History:     req.History,
		},
	})
}

// ============================================================
// DeleteSession — 删除会话及其所有消息
// DELETE /api/sessions/:id
// ============================================================

func DeleteSession(c *gin.Context) {
	userID := getUserID(c)
	id := c.Param("id")

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "事务开始失败"})
		return
	}
	defer tx.Rollback()

	// 先确认会话存在
	var sessionExists int
	database.DB.QueryRow("SELECT COUNT(*) FROM chat_sessions WHERE id = ? AND user_id = ?", id, userID).Scan(&sessionExists)
	if sessionExists == 0 {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Success: false, Error: "Session not found"})
		return
	}

	tx.Exec("DELETE FROM chat_messages WHERE session_id = ?", id)
	res, err := tx.Exec("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "删除会话失败"})
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Success: false, Error: "Session not found"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, models.SuccessResponse{Success: true})
}

// ============================================================
// CreateSession — 新建空会话
// POST /api/sessions
// ============================================================

func CreateSession(c *gin.Context) {
	userID := getUserID(c)
	id := fmt.Sprintf("session-%016x", func() int64 {
		n, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
		return n.Int64()
	}())
	now := time.Now().UnixMilli()

	_, err := database.DB.Exec(
		"INSERT INTO chat_sessions (id, user_id, title, message_count, created_at, updated_at) VALUES (?, ?, '新对话', 0, ?, ?)",
		id, userID, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: "创建会话失败"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"session": models.ChatSessionDetail{
			ChatSession: models.ChatSession{ID: id, Title: "新对话", CreatedAt: now, UpdatedAt: now, MessageCount: 0},
			Messages:    []interface{}{},
			History:     []interface{}{},
		},
	})
}
