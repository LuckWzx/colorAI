package entity

// ============================================================
// 会话管理 - 数据库表模型
// ============================================================

// ChatSession 会话表模型（直接对应数据库 chat_sessions 表）
type ChatSession struct {
	ID           string `json:"-" gorm:"column:id;type:varchar(64);primaryKey;comment:会话ID"`   // 会话 ID
	UserID       string `json:"-" gorm:"column:user_id;type:varchar(64);index;comment:所属用户ID"` // 所属用户 ID
	Title        string `json:"-" gorm:"column:title;type:varchar(255);comment:会话标题"`          // 会话标题
	MessageCount int    `json:"-" gorm:"column:message_count;comment:消息数量"`                    // 消息数量
	CreatedAt    int64  `json:"-" gorm:"column:created_at;comment:创建时间戳"`                      // 创建时间戳
	UpdatedAt    int64  `json:"-" gorm:"column:updated_at;comment:更新时间戳"`                      // 更新时间戳
}

func (ChatSession) TableName() string {
	return "chat_sessions"
}

// ChatMessageRecord 会话消息表模型（直接对应数据库 chat_messages 表）
type ChatMessageRecord struct {
	ID        string `json:"-" gorm:"column:id;type:varchar(64);primaryKey;comment:消息ID"`      // 消息 ID
	SessionID string `json:"-" gorm:"column:session_id;type:varchar(64);index;comment:所属会话ID"` // 所属会话 ID
	Role      string `json:"-" gorm:"column:role;type:varchar(16);comment:角色"`                 // 角色：user / assistant
	MsgType   string `json:"-" gorm:"column:msg_type;type:varchar(32);comment:消息类型"`           // 消息类型：text / correct
	Content   string `json:"-" gorm:"column:content;type:text;comment:文本内容"`                   // 文本内容
	Payload   string `json:"-" gorm:"column:payload;type:text;comment:扩展数据"`                   // 扩展数据（JSON）
	SortOrder int    `json:"-" gorm:"column:sort_order;comment:消息排序"`                          // 消息排序
	CreatedAt int64  `json:"-" gorm:"column:created_at;comment:创建时间戳"`                         // 创建时间戳
}

func (ChatMessageRecord) TableName() string {
	return "chat_messages"
}
