package entity

// ============================================================
// 用户认证
// ============================================================

type User struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Phone     string `json:"phone"`
	Avatar    string `json:"avatar,omitempty"`
	CreatedAt int64  `json:"createdAt"`
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=2,max=20"`
	Phone    string `json:"phone" binding:"required,len=11"`
	Password string `json:"password" binding:"required,min=6,max=32"`
}

type LoginRequest struct {
	Phone    string `json:"phone" binding:"required,len=11"`
	Password string `json:"password" binding:"required,min=6"`
}

type AuthResponse struct {
	Success bool   `json:"success"`
	User    *User  `json:"user,omitempty"`
	Token   string `json:"token,omitempty"`
	Error   string `json:"error,omitempty"`
}
