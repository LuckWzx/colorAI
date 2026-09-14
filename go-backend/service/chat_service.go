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
	Chat(userID, sessionID string, messages []request.ChatMessage, model string) (*response.ChatResponse, error)
}

type chatService struct {
	llmCfg      config.LLMConfig
	sessionRepo repository.SessionRepository
}

// NewChatService 创建 ChatService 实例
func NewChatService(llmCfg config.LLMConfig, sessionRepo repository.SessionRepository) ChatService {
	return &chatService{llmCfg: llmCfg, sessionRepo: sessionRepo}
}

func (s *chatService) Chat(userID, sessionID string, messages []request.ChatMessage, model string) (*response.ChatResponse, error) {
	if s.llmCfg.APIKey == "" {
		return &response.ChatResponse{
			Success: false,
			Error:   "Server configuration error: LLM_API_KEY not set",
		}, nil
	}

	if len(messages) == 0 {
		return &response.ChatResponse{
			Success: false,
			Error:   "Invalid request: messages array is required",
		}, nil
	}

	if model == "" {
		model = s.llmCfg.Model
	}

	// 构建 LLM API 请求体
	body := map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"temperature": 0.7,
		"max_tokens":  s.llmCfg.MaxTokens,
	}
	bodyBytes, _ := json.Marshal(body)

	// 发送请求
	client := &http.Client{Timeout: time.Duration(s.llmCfg.TimeoutSec) * time.Second}
	httpReq, err := http.NewRequest("POST", s.llmCfg.APIURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.llmCfg.APIKey)

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("调用 AI 服务失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// 解析 LLM API 响应
	var dsResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Model string `json:"model"`
		Usage *struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &dsResp); err != nil {
		return nil, fmt.Errorf("解析 AI 服务响应失败: %w", err)
	}

	if dsResp.Error != nil {
		return &response.ChatResponse{
			Success: false,
			Error:   fmt.Sprintf("AI service error: %s", dsResp.Error.Message),
		}, nil
	}

	if len(dsResp.Choices) == 0 || dsResp.Choices[0].Message.Content == "" {
		return nil, fmt.Errorf("AI 服务返回空响应")
	}

	// 构建成功响应
	result := &response.ChatResponse{
		Success: true,
		Choices: []response.ChatChoice{
			{Message: response.ChatMessage{
				Role:    "assistant",
				Content: dsResp.Choices[0].Message.Content,
			}},
		},
		Model: dsResp.Model,
	}

	if dsResp.Usage != nil {
		result.Usage = &response.ChatUsage{
			PromptTokens:     dsResp.Usage.PromptTokens,
			CompletionTokens: dsResp.Usage.CompletionTokens,
			TotalTokens:      dsResp.Usage.TotalTokens,
		}
	}

	// 自动保存消息到会话
	if sessionID != "" && userID != "" {
		s.saveMessages(userID, sessionID, messages, dsResp.Choices[0].Message.Content)
	}

	return result, nil
}

// saveMessages 将用户消息和 AI 回复保存到会话
func (s *chatService) saveMessages(userID, sessionID string, userMessages []request.ChatMessage, assistantReply string) {
	now := time.Now().UnixMilli()
	records := make([]entity.ChatMessageRecord, 0, len(userMessages)+1)

	// 保存最后一条用户消息（前端只发最新一条）
	if len(userMessages) > 0 {
		last := userMessages[len(userMessages)-1]
		records = append(records, entity.ChatMessageRecord{
			ID:        chatMsgID(),
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
