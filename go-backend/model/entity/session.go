package entity

// ============================================================
// 会话管理
// ============================================================

// ChatSession 会话元数据（列表接口用）
type ChatSession struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
	MessageCount int    `json:"messageCount"`
}

// ChatSessionDetail 会话详情（含消息历史）
type ChatSessionDetail struct {
	ChatSession
	Messages interface{} `json:"messages,omitempty"`
	History  interface{} `json:"history,omitempty"`
}

// SaveSessionRequest 保存会话请求体
type SaveSessionRequest struct {
	Title    string      `json:"title"`
	Messages interface{} `json:"messages,omitempty"`
	History  interface{} `json:"history,omitempty"`
}
