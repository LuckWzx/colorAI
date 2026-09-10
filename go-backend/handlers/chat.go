package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"colorai-backend/models"

	"github.com/gin-gonic/gin"
)

const (
	// LLM 服务配置（当前接入 DeepSeek，后续可切换为其他模型）
	llmAPIURL       = "https://api.deepseek.com/v1/chat/completions"
	defaultModel    = "deepseek-v4-flash"
	llmMaxTokens    = 2000
	llmTimeoutSecs  = 30
)

// Chat AI 对话代理
// POST /api/chat
// 当前通过 DeepSeek API 实现，后续可切换为其他 LLM 服务
func Chat(c *gin.Context) {
	apiKey := os.Getenv("LLM_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, models.ChatResponse{
			Success: false,
			Error:   "Server configuration error: LLM_API_KEY not set",
		})
		return
	}

	var req models.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, models.ChatResponse{
			Success: false,
			Error:   "Invalid request: messages array is required",
		})
		return
	}

	model := req.Model
	if model == "" {
		model = defaultModel
	}

	// 构建 LLM API 请求体
	body := map[string]interface{}{
		"model":       model,
		"messages":    req.Messages,
		"temperature": 0.7,
		"max_tokens":  llmMaxTokens,
	}
	bodyBytes, _ := json.Marshal(body)

	// 发送请求
	client := &http.Client{Timeout: llmTimeoutSecs * time.Second}
	httpReq, err := http.NewRequest("POST", llmAPIURL, bytes.NewReader(bodyBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ChatResponse{
			Success: false,
			Error:   "Failed to create request: " + err.Error(),
		})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, models.ChatResponse{
			Success: false,
			Error:   "Failed to reach AI service: " + err.Error(),
		})
		return
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
		c.JSON(http.StatusBadGateway, models.ChatResponse{
			Success: false,
			Error:   "Invalid response from AI service",
		})
		return
	}

	// 检查 LLM API 错误
	if dsResp.Error != nil {
		c.JSON(resp.StatusCode, models.ChatResponse{
			Success: false,
			Error:   fmt.Sprintf("AI service error: %s", dsResp.Error.Message),
		})
		return
	}

	if len(dsResp.Choices) == 0 || dsResp.Choices[0].Message.Content == "" {
		c.JSON(http.StatusBadGateway, models.ChatResponse{
			Success: false,
			Error:   "Invalid response from AI service",
		})
		return
	}

	// 构建成功响应
	result := models.ChatResponse{
		Success: true,
		Choices: []models.ChatChoice{
			{Message: models.ChatMessage{
				Role:    "assistant",
				Content: dsResp.Choices[0].Message.Content,
			}},
		},
		Model: dsResp.Model,
	}

	if dsResp.Usage != nil {
		result.Usage = &models.ChatUsage{
			PromptTokens:     dsResp.Usage.PromptTokens,
			CompletionTokens: dsResp.Usage.CompletionTokens,
			TotalTokens:      dsResp.Usage.TotalTokens,
		}
	}

	c.JSON(http.StatusOK, result)
}
