package response

// ============================================================
// AI 对话 - API 响应体
// ============================================================

// ChatMessage 对话消息（响应）
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatChoice 对话选项
type ChatChoice struct {
	Message ChatMessage `json:"message"`
}

// ChatUsage Token 用量
type ChatUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

// MessageResponse 统一消息响应（与 Python Agent 格式对齐）
type MessageResponse struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Type      string `json:"type"`
	Content   string `json:"content"`
	Metadata  any    `json:"metadata"`
	CreatedAt int64  `json:"createdAt"`
}

// ChatResponse AI 对话响应
type ChatResponse struct {
	Success   bool             `json:"success"`
	Message   *MessageResponse `json:"message,omitempty"`
	Choices   []ChatChoice     `json:"choices,omitempty"`
	Model     string           `json:"model,omitempty"`
	MessageID string           `json:"messageId,omitempty"` // 后端返回的消息ID（用于SSE/WebSocket场景关联）
	Usage     *ChatUsage       `json:"usage,omitempty"`
	Error     string           `json:"error,omitempty"`
}
