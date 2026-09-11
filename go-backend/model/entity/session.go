package entity

// ============================================================
// 会话管理 - 数据库表模型
// ============================================================

// ChatSession 会话表模型（直接对应数据库 chat_sessions 表）
type ChatSession struct {
	ID           string `json:"-" gorm:"column:id;primaryKey"`
	UserID       string `json:"-" gorm:"column:user_id"`
	Title        string `json:"-" gorm:"column:title"`
	MessageCount int    `json:"-" gorm:"column:message_count"`
	CreatedAt    int64  `json:"-" gorm:"column:created_at"`
	UpdatedAt    int64  `json:"-" gorm:"column:updated_at"`
}

func (ChatSession) TableName() string {
	return "chat_sessions"
}

// ChatMessageRecord 会话消息表模型（直接对应数据库 chat_messages 表）
type ChatMessageRecord struct {
	ID        string `json:"-" gorm:"column:id;primaryKey"`
	SessionID string `json:"-" gorm:"column:session_id"`
	Role      string `json:"-" gorm:"column:role"`
	MsgType   string `json:"-" gorm:"column:msg_type"`
	Content   string `json:"-" gorm:"column:content"`
	Payload   string `json:"-" gorm:"column:payload"`
	SortOrder int    `json:"-" gorm:"column:sort_order"`
	CreatedAt int64  `json:"-" gorm:"column:created_at"`
}

func (ChatMessageRecord) TableName() string {
	return "chat_messages"
}
