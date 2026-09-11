package repository

import (
	"colorai-backend/model/entity"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
)

// SessionRepository 会话数据访问接口
type SessionRepository interface {
	ListByUser(userID string) ([]entity.ChatSession, error)
	FindByID(sessionID, userID string) (*entity.ChatSessionDetail, error)
	Create(sessionID, userID, title string, now int64) error
	Save(sessionID, userID, title string, messages []interface{}, now int64) error
	Delete(sessionID, userID string) error
}

// mysqlSessionRepository MySQL 会话数据访问实现
type mysqlSessionRepository struct {
	db *sql.DB
}

// NewSessionRepository 创建 SessionRepository 实例
func NewSessionRepository(db *sql.DB) SessionRepository {
	return &mysqlSessionRepository{db: db}
}

func (r *mysqlSessionRepository) ListByUser(userID string) ([]entity.ChatSession, error) {
	rows, err := r.db.Query(
		"SELECT id, title, created_at, updated_at, message_count FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]entity.ChatSession, 0)
	for rows.Next() {
		var s entity.ChatSession
		if err := rows.Scan(&s.ID, &s.Title, &s.CreatedAt, &s.UpdatedAt, &s.MessageCount); err != nil {
			continue
		}
		list = append(list, s)
	}
	return list, nil
}

func (r *mysqlSessionRepository) FindByID(sessionID, userID string) (*entity.ChatSessionDetail, error) {
	var detail entity.ChatSessionDetail
	err := r.db.QueryRow(
		"SELECT id, title, created_at, updated_at, message_count FROM chat_sessions WHERE id = ? AND user_id = ?",
		sessionID, userID,
	).Scan(&detail.ID, &detail.Title, &detail.CreatedAt, &detail.UpdatedAt, &detail.MessageCount)

	if err != nil {
		return nil, err
	}

	// 加载消息
	msgs, hist, err := r.loadMessages(sessionID)
	if err != nil {
		return nil, err
	}
	detail.Messages = msgs
	detail.History = hist

	return &detail, nil
}

func (r *mysqlSessionRepository) Create(sessionID, userID, title string, now int64) error {
	_, err := r.db.Exec(
		"INSERT INTO chat_sessions (id, user_id, title, message_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
		sessionID, userID, title, now, now,
	)
	return err
}

func (r *mysqlSessionRepository) Save(sessionID, userID, title string, messages []interface{}, now int64) error {
	msgCount := len(messages)

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("事务开始失败: %w", err)
	}
	defer tx.Rollback()

	// upsert 会话元数据
	var sessionCreatedAt int64
	err = tx.QueryRow("SELECT created_at FROM chat_sessions WHERE id = ? AND user_id = ?", sessionID, userID).Scan(&sessionCreatedAt)

	if err == nil {
		_, err = tx.Exec("UPDATE chat_sessions SET title = ?, message_count = ?, updated_at = ? WHERE id = ? AND user_id = ?",
			title, msgCount, now, sessionID, userID)
	} else {
		sessionCreatedAt = now
		_, err = tx.Exec("INSERT INTO chat_sessions (id, user_id, title, message_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			sessionID, userID, title, msgCount, now, now)
	}
	if err != nil {
		return fmt.Errorf("保存会话失败: %w", err)
	}

	// 删除旧消息
	tx.Exec("DELETE FROM chat_messages WHERE session_id = ?", sessionID)

	// 批量插入新消息
	if len(messages) > 0 {
		stmt, err := tx.Prepare(
			"INSERT INTO chat_messages (id, session_id, role, msg_type, content, payload, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
		if err != nil {
			return fmt.Errorf("准备插入消息失败: %w", err)
		}
		defer stmt.Close()

		for order, raw := range messages {
			m, ok := raw.(map[string]interface{})
			if !ok {
				continue
			}
			msgID, _ := m["id"].(string)
			if msgID == "" {
				msgID = genMsgID()
			}
			role, _ := m["role"].(string)
			msgType, _ := m["type"].(string)
			if msgType == "" {
				msgType = "text"
			}
			text, _ := m["text"].(string)
			msgCreatedAt, _ := m["createdAt"].(float64)

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

			if _, execErr := stmt.Exec(msgID, sessionID, role, msgType, text, string(payloadJSON), order, int64(msgCreatedAt)); execErr != nil {
				log.Printf("插入消息 %s 失败: %v", msgID, execErr)
			}
		}
	}

	return tx.Commit()
}

func (r *mysqlSessionRepository) Delete(sessionID, userID string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("事务开始失败: %w", err)
	}
	defer tx.Rollback()

	// 确认会话存在
	var exists int
	r.db.QueryRow("SELECT COUNT(*) FROM chat_sessions WHERE id = ? AND user_id = ?", sessionID, userID).Scan(&exists)
	if exists == 0 {
		return sql.ErrNoRows
	}

	tx.Exec("DELETE FROM chat_messages WHERE session_id = ?", sessionID)
	_, err = tx.Exec("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", sessionID, userID)
	if err != nil {
		return fmt.Errorf("删除会话失败: %w", err)
	}

	return tx.Commit()
}

// loadMessages 从 chat_messages 表加载消息
func (r *mysqlSessionRepository) loadMessages(sessionID string) (messages []interface{}, history []interface{}, err error) {
	rows, err := r.db.Query(
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

		msg := map[string]interface{}{
			"id":        msgID,
			"role":      role,
			"type":      msgType,
			"createdAt": createdAt,
		}
		if content != "" {
			msg["text"] = content
		}

		if payloadStr.Valid && payloadStr.String != "" && payloadStr.String != "null" {
			var payload map[string]interface{}
			if json.Unmarshal([]byte(payloadStr.String), &payload) == nil {
				for k, v := range payload {
					msg[k] = v
				}
			}
		}

		messages = append(messages, msg)

		if content != "" {
			history = append(history, map[string]string{"role": role, "content": content})
		}
	}
	return messages, history, nil
}

func genMsgID() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
	return fmt.Sprintf("msg-%016x", n.Int64())
}
