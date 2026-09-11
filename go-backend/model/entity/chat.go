package entity

// ============================================================
// AI 对话代理
// ============================================================

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Messages []ChatMessage `json:"messages"`
	Model    string        `json:"model,omitempty"`
}

type ChatChoice struct {
	Message ChatMessage `json:"message"`
}

type ChatUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

type ChatResponse struct {
	Success bool         `json:"success"`
	Choices []ChatChoice `json:"choices"`
	Model   string       `json:"model"`
	Usage   *ChatUsage   `json:"usage,omitempty"`
	Error   string       `json:"error,omitempty"`
}
