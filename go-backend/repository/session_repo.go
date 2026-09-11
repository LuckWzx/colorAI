package repository

import (
	"colorai-backend/model/entity"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"

	"gorm.io/gorm"
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
	db *gorm.DB
}

// NewSessionRepository 创建 SessionRepository 实例
func NewSessionRepository(db *gorm.DB) SessionRepository {
	return &mysqlSessionRepository{db: db}
}

func (r *mysqlSessionRepository) ListByUser(userID string) ([]entity.ChatSession, error) {
	var sessions []entity.ChatSession
	err := r.db.Where("user_id = ?", userID).Order("updated_at DESC").Find(&sessions).Error
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *mysqlSessionRepository) FindByID(sessionID, userID string) (*entity.ChatSessionDetail, error) {
	var session entity.ChatSession
	err := r.db.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error
	if err != nil {
		return nil, err
	}

	// 加载消息
	msgs, hist, err := r.loadMessages(sessionID)
	if err != nil {
		return nil, err
	}

	return &entity.ChatSessionDetail{
		ChatSession: session,
		Messages:    msgs,
		History:     hist,
	}, nil
}

func (r *mysqlSessionRepository) Create(sessionID, userID, title string, now int64) error {
	session := entity.ChatSession{
		ID:           sessionID,
		UserID:       userID,
		Title:        title,
		MessageCount: 0,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	return r.db.Create(&session).Error
}

func (r *mysqlSessionRepository) Save(sessionID, userID, title string, messages []interface{}, now int64) error {
	msgCount := len(messages)

	return r.db.Transaction(func(tx *gorm.DB) error {
		// upsert 会话元数据
		var session entity.ChatSession
		err := tx.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error

		if err == gorm.ErrRecordNotFound {
			// 创建新会话
			session = entity.ChatSession{
				ID:           sessionID,
				UserID:       userID,
				Title:        title,
				MessageCount: msgCount,
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			if err := tx.Create(&session).Error; err != nil {
				return fmt.Errorf("创建会话失败: %w", err)
			}
		} else if err != nil {
			return fmt.Errorf("查询会话失败: %w", err)
		} else {
			// 更新现有会话
			if err := tx.Model(&session).Updates(map[string]interface{}{
				"title":         title,
				"message_count": msgCount,
				"updated_at":    now,
			}).Error; err != nil {
				return fmt.Errorf("更新会话失败: %w", err)
			}
		}

		// 删除旧消息
		if err := tx.Where("session_id = ?", sessionID).Delete(&entity.ChatMessageRecord{}).Error; err != nil {
			return fmt.Errorf("删除旧消息失败: %w", err)
		}

		// 批量插入新消息
		if len(messages) > 0 {
			msgRecords := make([]entity.ChatMessageRecord, 0, len(messages))
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

				msgRecords = append(msgRecords, entity.ChatMessageRecord{
					ID:        msgID,
					SessionID: sessionID,
					Role:      role,
					MsgType:   msgType,
					Content:   text,
					Payload:   string(payloadJSON),
					SortOrder: order,
					CreatedAt: int64(msgCreatedAt),
				})
			}

			if len(msgRecords) > 0 {
				if err := tx.CreateInBatches(msgRecords, 100).Error; err != nil {
					log.Printf("批量插入消息失败: %v", err)
				}
			}
		}

		return nil
	})
}

func (r *mysqlSessionRepository) Delete(sessionID, userID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 确认会话存在
		var count int64
		if err := tx.Model(&entity.ChatSession{}).Where("id = ? AND user_id = ?", sessionID, userID).Count(&count).Error; err != nil {
			return fmt.Errorf("查询会话失败: %w", err)
		}
		if count == 0 {
			return fmt.Errorf("会话不存在")
		}

		// 删除消息
		if err := tx.Where("session_id = ?", sessionID).Delete(&entity.ChatMessageRecord{}).Error; err != nil {
			return fmt.Errorf("删除消息失败: %w", err)
		}

		// 删除会话
		if err := tx.Where("id = ? AND user_id = ?", sessionID, userID).Delete(&entity.ChatSession{}).Error; err != nil {
			return fmt.Errorf("删除会话失败: %w", err)
		}

		return nil
	})
}

// loadMessages 从 chat_messages 表加载消息
func (r *mysqlSessionRepository) loadMessages(sessionID string) (messages []interface{}, history []interface{}, err error) {
	var msgRecords []entity.ChatMessageRecord
	err = r.db.Where("session_id = ?", sessionID).Order("sort_order").Find(&msgRecords).Error
	if err != nil {
		return nil, nil, err
	}

	messages = make([]interface{}, 0, len(msgRecords))
	history = make([]interface{}, 0)

	for _, m := range msgRecords {
		msg := map[string]interface{}{
			"id":        m.ID,
			"role":      m.Role,
			"type":      m.MsgType,
			"createdAt": m.CreatedAt,
		}
		if m.Content != "" {
			msg["text"] = m.Content
		}

		if m.Payload != "" && m.Payload != "null" && m.Payload != "{}" {
			var payload map[string]interface{}
			if err := json.Unmarshal([]byte(m.Payload), &payload); err == nil {
				for k, v := range payload {
					msg[k] = v
				}
			}
		}

		messages = append(messages, msg)

		if m.Content != "" {
			history = append(history, map[string]string{"role": m.Role, "content": m.Content})
		}
	}
	return messages, history, nil
}

func genMsgID() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
	return fmt.Sprintf("msg-%016x", n.Int64())
}
