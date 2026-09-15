package request

// ============================================================
// AI 对话 - API 请求体
// ============================================================

// ChatMessage 对话消息
type ChatMessage struct {
	Role    string   `json:"role"`
	Content string   `json:"content"`
	Feature *string  `json:"feature,omitempty"` // 快捷工具标识：correct / pick / compare / convert / phone
	Images  []string `json:"images,omitempty"`  // 图片数据数组（base64 格式）
}

// ChatRequest AI 对话请求
type ChatRequest struct {
	SessionID string        `json:"sessionId"`
	MessageID string        `json:"messageId"` // 前端生成的消息ID（用于SSE/WebSocket场景关联）
	Messages  []ChatMessage `json:"messages"`
	Model     string        `json:"model,omitempty"`
}
