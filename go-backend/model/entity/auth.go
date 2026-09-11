package entity

// ============================================================
// 数据库表模型 - 仅包含纯 GORM 模型
// ============================================================

import "time"

// User 用户表模型（直接对应数据库 users 表）
type User struct {
	ID        string    `json:"-" gorm:"column:id;primaryKey"`
	Username  string    `json:"-" gorm:"column:username"`
	Phone     string    `json:"-" gorm:"column:phone"`
	Avatar    string    `json:"-" gorm:"column:avatar"`
	CreatedAt time.Time `json:"-" gorm:"column:created_at"`
	Password  string    `json:"-" gorm:"column:password_hash"`
}

func (User) TableName() string {
	return "users"
}
