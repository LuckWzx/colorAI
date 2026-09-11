package request

// ============================================================
// 会话管理 - API 请求体
// ============================================================

// SaveSessionRequest 保存会话请求体
type SaveSessionRequest struct {
	Title    string      `json:"title"`
	Messages interface{} `json:"messages,omitempty"`
	History  interface{} `json:"history,omitempty"`
}
