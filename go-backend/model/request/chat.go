package request

// ============================================================
// AI 对话 - API 请求体
// ============================================================

// ChatMessage 对话消息
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest AI 对话请求
type ChatRequest struct {
	SessionID string      `json:"sessionId"`
	Messages  []ChatMessage `json:"messages"`
	Model     string        `json:"model,omitempty"`
}
