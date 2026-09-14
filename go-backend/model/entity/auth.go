package entity

// ============================================================
// 数据库表模型 - 仅包含纯 GORM 模型
// ============================================================

import "time"

// User 用户表模型（直接对应数据库 users 表）
type User struct {
	ID        string    `json:"-" gorm:"column:id;type:varchar(64);primaryKey;comment:用户ID"`        // 用户 ID
	Username  string    `json:"-" gorm:"column:username;type:varchar(64);comment:用户名"`              // 用户名
	Phone     string    `json:"-" gorm:"column:phone;type:varchar(20);uniqueIndex;comment:手机号"`     // 手机号（唯一）
	Avatar    string    `json:"-" gorm:"column:avatar;type:varchar(255);comment:头像URL"`             // 头像 URL
	CreatedAt time.Time `json:"-" gorm:"column:created_at;comment:创建时间"`                            // 创建时间
	Password  string    `json:"-" gorm:"column:password_hash;type:varchar(128);comment:密码SHA256哈希"` // 密码 SHA-256 哈希
}

func (User) TableName() string {
	return "users"
}
