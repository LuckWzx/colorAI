package service

import (
	"bytes"
	"colorai-backend/model/entity"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"colorai-backend/config"
)

// ChatService AI 对话业务接口
type ChatService interface {
	Chat(messages []entity.ChatMessage, model string) (*entity.ChatResponse, error)
}

type chatService struct {
	llmCfg config.LLMConfig
}

// NewChatService 创建 ChatService 实例
func NewChatService(llmCfg config.LLMConfig) ChatService {
	return &chatService{llmCfg: llmCfg}
}

func (s *chatService) Chat(messages []entity.ChatMessage, model string) (*entity.ChatResponse, error) {
	if s.llmCfg.APIKey == "" {
		return &entity.ChatResponse{
			Success: false,
			Error:   "Server configuration error: LLM_API_KEY not set",
		}, nil
	}

	if len(messages) == 0 {
		return &entity.ChatResponse{
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
		return &entity.ChatResponse{
			Success: false,
			Error:   fmt.Sprintf("AI service error: %s", dsResp.Error.Message),
		}, nil
	}

	if len(dsResp.Choices) == 0 || dsResp.Choices[0].Message.Content == "" {
		return nil, fmt.Errorf("AI 服务返回空响应")
	}

	// 构建成功响应
	result := &entity.ChatResponse{
		Success: true,
		Choices: []entity.ChatChoice{
			{Message: entity.ChatMessage{
				Role:    "assistant",
				Content: dsResp.Choices[0].Message.Content,
			}},
		},
		Model: dsResp.Model,
	}

	if dsResp.Usage != nil {
		result.Usage = &entity.ChatUsage{
			PromptTokens:     dsResp.Usage.PromptTokens,
			CompletionTokens: dsResp.Usage.CompletionTokens,
			TotalTokens:      dsResp.Usage.TotalTokens,
		}
	}

	return result, nil
}
