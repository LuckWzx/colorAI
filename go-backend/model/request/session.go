package request

// ============================================================
// 会话管理 - API 请求体
// ============================================================

// CreateSessionRequest 创建会话请求体
type CreateSessionRequest struct {
	Title string `json:"title"` // 会话标题（可选，不传则默认为"新对话"）
}

// SaveSessionRequest 保存会话请求体
type SaveSessionRequest struct {
	Title    string      `json:"title"`
	Messages interface{} `json:"messages,omitempty"`
	History  interface{} `json:"history,omitempty"`
}
