package service

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"math/big"
	"time"

	"colorai-backend/models"
	"colorai-backend/repository"
)

// SessionService 会话管理业务接口
type SessionService interface {
	ListByUser(userID string) ([]models.ChatSession, error)
	GetByID(userID, sessionID string) (*models.ChatSessionDetail, error)
	Create(userID string) (*models.ChatSessionDetail, error)
	Save(userID, sessionID string, req models.SaveSessionRequest) (*models.ChatSessionDetail, error)
	Delete(userID, sessionID string) error
}

type sessionService struct {
	sessionRepo repository.SessionRepository
}

// NewSessionService 创建 SessionService 实例
func NewSessionService(sessionRepo repository.SessionRepository) SessionService {
	return &sessionService{sessionRepo: sessionRepo}
}

func (s *sessionService) ListByUser(userID string) ([]models.ChatSession, error) {
	return s.sessionRepo.ListByUser(userID)
}

func (s *sessionService) GetByID(userID, sessionID string) (*models.ChatSessionDetail, error) {
	detail, err := s.sessionRepo.FindByID(sessionID, userID)
	if err == sql.ErrNoRows {
		return nil, &ServiceError{StatusCode: 404, Message: "Session not found"}
	}
	return detail, err
}

func (s *sessionService) Create(userID string) (*models.ChatSessionDetail, error) {
	id := fmt.Sprintf("session-%016x", func() int64 {
		n, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
		return n.Int64()
	}())
	now := time.Now().UnixMilli()

	if err := s.sessionRepo.Create(id, userID, "新对话", now); err != nil {
		return nil, fmt.Errorf("创建会话失败: %w", err)
	}

	return &models.ChatSessionDetail{
		ChatSession: models.ChatSession{
			ID:           id,
			Title:        "新对话",
			CreatedAt:    now,
			UpdatedAt:    now,
			MessageCount: 0,
		},
		Messages: []interface{}{},
		History:  []interface{}{},
	}, nil
}

func (s *sessionService) Save(userID, sessionID string, req models.SaveSessionRequest) (*models.ChatSessionDetail, error) {
	now := time.Now().UnixMilli()
	title := req.Title
	if title == "" {
		title = "新对话"
	}

	var messages []interface{}
	if req.Messages != nil {
		if msgs, ok := req.Messages.([]interface{}); ok {
			messages = msgs
		}
	}
	if messages == nil {
		messages = []interface{}{}
	}

	if err := s.sessionRepo.Save(sessionID, userID, title, messages, now); err != nil {
		return nil, fmt.Errorf("保存会话失败: %w", err)
	}

	return &models.ChatSessionDetail{
		ChatSession: models.ChatSession{
			ID:           sessionID,
			Title:        title,
			UpdatedAt:    now,
			MessageCount: len(messages),
		},
		Messages: messages,
		History:  req.History,
	}, nil
}

func (s *sessionService) Delete(userID, sessionID string) error {
	err := s.sessionRepo.Delete(sessionID, userID)
	if err == sql.ErrNoRows {
		return &ServiceError{StatusCode: 404, Message: "Session not found"}
	}
	return err
}
