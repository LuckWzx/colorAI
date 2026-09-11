package response

import (
	"colorai-backend/model/entity"
	"time"
)

// UserResponse 用户信息响应
type UserResponse struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Phone     string    `json:"phone"`
	Avatar    string    `json:"avatar,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// UserFromEntity 将 DB 模型转换为响应结构
func UserFromEntity(u entity.User) UserResponse {
	return UserResponse{
		ID:        u.ID,
		Username:  u.Username,
		Phone:     u.Phone,
		Avatar:    u.Avatar,
		CreatedAt: u.CreatedAt,
	}
}

// AuthResponse 认证响应
type AuthResponse struct {
	Success bool          `json:"success"`
	User    *UserResponse `json:"user,omitempty"`
	Token   string        `json:"token,omitempty"`
	Error   string        `json:"error,omitempty"`
}
