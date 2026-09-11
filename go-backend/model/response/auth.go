package response

// ============================================================
// 用户认证 - API 响应体
// ============================================================

import "colorai-backend/model/entity"

// AuthResponse 认证响应
type AuthResponse struct {
	Success bool         `json:"success"`
	User    *entity.User `json:"user,omitempty"`
	Token   string       `json:"token,omitempty"`
	Error   string       `json:"error,omitempty"`
}
