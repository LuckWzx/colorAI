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

// ChatResponse AI 对话响应
type ChatResponse struct {
	Success bool         `json:"success"`
	Choices []ChatChoice `json:"choices"`
	Model   string       `json:"model"`
	Usage   *ChatUsage   `json:"usage,omitempty"`
	Error   string       `json:"error,omitempty"`
}
