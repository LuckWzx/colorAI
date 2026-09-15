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
)

// ChatService AI 对话业务接口
type ChatService interface {
	Chat(userID, sessionID, messageID string, messages []request.ChatMessage, model string) (*response.ChatResponse, error)
}

type chatService struct {
	sessionRepo repository.SessionRepository
	storage     Storage
	// agentURL Python 智能体基地址，来自 config.AgentURL（勿硬编码，见 MEMORY 里的部署地雷）
	agentURL string
}

// NewChatService 创建 ChatService 实例
func NewChatService(sessionRepo repository.SessionRepository, storage Storage, agentURL string) ChatService {
	return &chatService{sessionRepo: sessionRepo, storage: storage, agentURL: agentURL}
}

// resolveImages 把 messages 里的图片 dataURL 落盘并换成完整 URL。
//
// 这是「图片永不进入 Agent / tool / LLM」这条约定的落地点：
// 前端传的是 base64 dataURL，在转发给 Agent 之前统一换成 URL。
// 已经是 URL 的原样保留（幂等），落盘失败直接返回错误而不是静默降级 ——
// 否则 tool 拿不到图片，用户会看到一个莫名其妙的校色失败。
func (s *chatService) resolveImages(messages []request.ChatMessage) ([]request.ChatMessage, error) {
	resolved := make([]request.ChatMessage, len(messages))
	copy(resolved, messages)

	for i := range resolved {
		if len(resolved[i].Images) == 0 {
			continue
		}
		urls := make([]string, len(resolved[i].Images))
		for j, raw := range resolved[i].Images {
			url, err := s.storage.SaveDataURL(raw)
			if err != nil {
				return nil, fmt.Errorf("第 %d 条消息的第 %d 张图片保存失败: %w", i+1, j+1, err)
			}
			urls[j] = url
		}
		resolved[i].Images = urls
	}
	return resolved, nil
}

func (s *chatService) Chat(userID, sessionID, messageID string, messages []request.ChatMessage, model string) (*response.ChatResponse, error) {
	if len(messages) == 0 {
		return &response.ChatResponse{
			Success: false,
			Error:   "Invalid request: messages array is required",
		}, nil
	}

	// 先落盘换 URL，后续 Agent 调用与落库都用这份
	resolved, err := s.resolveImages(messages)
	if err != nil {
		return &response.ChatResponse{Success: false, Error: err.Error()}, nil
	}

	// 将前端消息格式转换为 Python Agent 格式
	agentMessages := make([]map[string]interface{}, len(resolved))
	for i, msg := range resolved {
		agentMsg := map[string]interface{}{
			"role":    msg.Role,
			"content": msg.Content,
		}
		if msg.Feature != nil {
			agentMsg["feature"] = *msg.Feature
		}
		if len(msg.Images) > 0 {
			agentMsg["images"] = msg.Images
		}
		agentMessages[i] = agentMsg
	}

	// 构建请求体
	body := map[string]interface{}{
		"messages": agentMessages,
	}
	bodyBytes, _ := json.Marshal(body)

	// 发送请求到 Python Agent
	client := &http.Client{Timeout: 60 * time.Second}
	agentChatURL := s.agentURL + "/api/chat"
	httpReq, err := http.NewRequest("POST", agentChatURL, bytes.NewReader(bodyBytes))
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
		s.saveMessages(userID, sessionID, messageID, resolved, &response.MessageResponse{
			ID:       agentResp.Message.ID,
			Role:     agentResp.Message.Role,
			Type:     agentResp.Message.Type,
			Content:  agentResp.Message.Content,
			Metadata: agentResp.Message.Metadata,
		})
	}

	return result, nil
}

// saveMessages 将用户消息和 AI 回复保存到会话
//
// 落库规则（与 API.md 对齐）：
//   - 只落「最后一条用户消息 + AI 回复」，历史轮次不重复落库
//   - 用户消息的 payload 存 feature 与 images（**图片存 URL，不存 base64**）
//   - AI 回复的 msgType 必须等于响应里的 message.type，payload 存 metadata，
//     否则刷新页面后卡片会退化成纯文本（loadMessages 会把 payload 摊平进消息对象）
func (s *chatService) saveMessages(userID, sessionID, messageID string, userMessages []request.ChatMessage, assistant *response.MessageResponse) {
	now := time.Now().UnixMilli()
	records := make([]entity.ChatMessageRecord, 0, len(userMessages)+1)

	// 保存最后一条用户消息
	if len(userMessages) > 0 {
		last := userMessages[len(userMessages)-1]
		msgID := chatMsgID()
		if messageID != "" {
			msgID = messageID
		}

		payload := map[string]interface{}{}
		if last.Feature != nil {
			payload["feature"] = *last.Feature
		}
		if len(last.Images) > 0 {
			payload["images"] = last.Images
		}
		payloadJSON, _ := json.Marshal(payload)
		if len(payload) == 0 {
			payloadJSON = []byte("null")
		}

		records = append(records, entity.ChatMessageRecord{
			ID:        msgID,
			SessionID: sessionID,
			Role:      last.Role,
			MsgType:   "text",
			Content:   last.Content,
			Payload:   string(payloadJSON),
			CreatedAt: now,
		})
	}

	// 保存 AI 回复：msgType 用真实的卡片类型，payload 存 metadata
	assistantType := "text"
	assistantPayload := "null"
	if assistant != nil {
		if assistant.Type != "" {
			assistantType = assistant.Type
		}
		if assistant.Metadata != nil {
			if b, err := json.Marshal(map[string]interface{}{"metadata": assistant.Metadata}); err == nil {
				assistantPayload = string(b)
			}
		}
	}

	records = append(records, entity.ChatMessageRecord{
		ID:        chatMsgID(),
		SessionID: sessionID,
		Role:      "assistant",
		MsgType:   assistantType,
		Content:   assistant.Content,
		Payload:   assistantPayload,
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
