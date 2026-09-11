package response

// ============================================================
// 会话管理 - API 响应体
// ============================================================

import "colorai-backend/model/entity"

// ChatSessionResponse 会话列表项响应
type ChatSessionResponse struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
	MessageCount int    `json:"messageCount"`
}

// ChatSessionDetail 会话详情（含消息历史）
type ChatSessionDetail struct {
	ChatSessionResponse
	Messages interface{} `json:"messages,omitempty"`
	History  interface{} `json:"history,omitempty"`
}

// SessionFromEntity 将 DB 模型转换为响应结构
func SessionFromEntity(s entity.ChatSession) ChatSessionResponse {
	return ChatSessionResponse{
		ID:           s.ID,
		Title:        s.Title,
		CreatedAt:    s.CreatedAt,
		UpdatedAt:    s.UpdatedAt,
		MessageCount: s.MessageCount,
	}
}
