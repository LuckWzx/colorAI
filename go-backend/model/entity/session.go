package entity

// ============================================================
// 会话管理
// ============================================================

// ChatSession 会话表模型（直接对应数据库 chat_sessions 表）
type ChatSession struct {
	ID           string `json:"id" gorm:"column:id;primaryKey"`
	UserID       string `json:"userId" gorm:"column:user_id"`
	Title        string `json:"title" gorm:"column:title"`
	MessageCount int    `json:"messageCount" gorm:"column:message_count"`
	CreatedAt    int64  `json:"createdAt" gorm:"column:created_at"`
	UpdatedAt    int64  `json:"updatedAt" gorm:"column:updated_at"`
}

func (ChatSession) TableName() string {
	return "chat_sessions"
}

// ChatSessionDetail 会话详情（含消息历史，非数据库表结构）
type ChatSessionDetail struct {
	ChatSession
	Messages interface{} `json:"messages,omitempty" gorm:"-"`
	History  interface{} `json:"history,omitempty" gorm:"-"`
}

// SaveSessionRequest 保存会话请求体
type SaveSessionRequest struct {
	Title    string      `json:"title"`
	Messages interface{} `json:"messages,omitempty"`
	History  interface{} `json:"history,omitempty"`
}

// ============================================================
// 消息管理
// ============================================================

// ChatMessage 会话消息表模型（直接对应数据库 chat_messages 表）
// 注意：此结构体与 chat.go 中的 ChatMessage 不同，这个是数据库表结构
type ChatMessageRecord struct {
	ID        string `json:"id" gorm:"column:id;primaryKey"`
	SessionID string `json:"sessionId" gorm:"column:session_id"`
	Role      string `json:"role" gorm:"column:role"`
	MsgType   string `json:"type" gorm:"column:msg_type"`
	Content   string `json:"content" gorm:"column:content"`
	Payload   string `json:"payload" gorm:"column:payload"`
	SortOrder int    `json:"sortOrder" gorm:"column:sort_order"`
	CreatedAt int64  `json:"createdAt" gorm:"column:created_at"`
}

func (ChatMessageRecord) TableName() string {
	return "chat_messages"
}
