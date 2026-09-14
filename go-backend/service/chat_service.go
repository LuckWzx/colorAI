package service

import (
	"bytes"
	"colorai-backend/model/entity"
	"colorai-backend/model/request"
	"colorai-backend/model/response"
	"colorai-backend/repository"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"time"

	"colorai-backend/config"
)

// ChatService AI 对话业务接口
type ChatService interface {
	Chat(userID, sessionID, messageID string, messages []request.ChatMessage, model string) (*response.ChatResponse, error)
}

type chatService struct {
	llmCfg      config.LLMConfig
	sessionRepo repository.SessionRepository
}

// NewChatService 创建 ChatService 实例
func NewChatService(llmCfg config.LLMConfig, sessionRepo repository.SessionRepository) ChatService {
	return &chatService{llmCfg: llmCfg, sessionRepo: sessionRepo}
}

func (s *chatService) Chat(userID, sessionID, messageID string, messages []request.ChatMessage, model string) (*response.ChatResponse, error) {
	if len(messages) == 0 {
		return &response.ChatResponse{
			Success: false,
			Error:   "Invalid request: messages array is required",
		}, nil
	}

	// 将前端消息格式转换为 Python Agent 格式
	agentMessages := make([]map[string]string, len(messages))
	for i, msg := range messages {
		agentMessages[i] = map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		}
	}

	// 构建请求体
	body := map[string]interface{}{
		"messages": agentMessages,
	}
	bodyBytes, _ := json.Marshal(body)

	// 发送请求到 Python Agent
	client := &http.Client{Timeout: 60 * time.Second}
	httpReq, err := http.NewRequest("POST", "http://localhost:8000/api/chat", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("调用 Python Agent 失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// 解析 Python Agent 响应
	var agentResp struct {
		Success bool `json:"success"`
		Message *struct {
			ID        string `json:"id"`
			Role      string `json:"role"`
			Type      string `json:"type"`
			Content   string `json:"content"`
			Metadata  any    `json:"metadata"`
			CreatedAt int64  `json:"createdAt"`
		} `json:"message"`
		Usage *struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(respBody, &agentResp); err != nil {
		return nil, fmt.Errorf("解析 Python Agent 响应失败: %w", err)
	}

	if !agentResp.Success {
		return &response.ChatResponse{
			Success: false,
			Error:   agentResp.Error,
		}, nil
	}

	if agentResp.Message == nil {
		return nil, fmt.Errorf("Python Agent 返回空消息")
	}

	// 构建成功响应
	result := &response.ChatResponse{
		Success: true,
		Message: &response.MessageResponse{
			ID:        agentResp.Message.ID,
			Role:      agentResp.Message.Role,
			Type:      agentResp.Message.Type,
			Content:   agentResp.Message.Content,
			Metadata:  agentResp.Message.Metadata,
			CreatedAt: agentResp.Message.CreatedAt,
		},
		MessageID: messageID,
	}

	if agentResp.Usage != nil {
		result.Usage = &response.ChatUsage{
			PromptTokens:     agentResp.Usage.PromptTokens,
			CompletionTokens: agentResp.Usage.CompletionTokens,
			TotalTokens:      agentResp.Usage.TotalTokens,
		}
	}

	// 自动保存消息到会话
	if sessionID != "" && userID != "" {
		s.saveMessages(userID, sessionID, messageID, messages, agentResp.Message.Content)
	}

	return result, nil
}

// saveMessages 将用户消息和 AI 回复保存到会话
func (s *chatService) saveMessages(userID, sessionID, messageID string, userMessages []request.ChatMessage, assistantReply string) {
	now := time.Now().UnixMilli()
	records := make([]entity.ChatMessageRecord, 0, len(userMessages)+1)

	// 保存最后一条用户消息（前端只发最新一条）
	if len(userMessages) > 0 {
		last := userMessages[len(userMessages)-1]
		// 使用前端传入的消息ID（如果有），否则生成新的
		msgID := chatMsgID()
		if messageID != "" {
			msgID = messageID
		}
		records = append(records, entity.ChatMessageRecord{
			ID:        msgID,
			SessionID: sessionID,
			Role:      last.Role,
			MsgType:   "text",
			Content:   last.Content,
			Payload:   "null",
			CreatedAt: now,
		})
	}

	// 保存 AI 回复
	records = append(records, entity.ChatMessageRecord{
		ID:        chatMsgID(),
		SessionID: sessionID,
		Role:      "assistant",
		MsgType:   "text",
		Content:   assistantReply,
		Payload:   "null",
		CreatedAt: now,
	})

	if err := s.sessionRepo.AppendMessages(sessionID, userID, records, now); err != nil {
		fmt.Printf("[chat] 自动保存消息失败: %v\n", err)
	}
}

func chatMsgID() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
	return fmt.Sprintf("msg-%016x", n.Int64())
}
