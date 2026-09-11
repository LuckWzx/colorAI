package entity

// ============================================================
// 用户认证
// ============================================================

type User struct {
	ID        string `json:"id" gorm:"column:id;primaryKey"`
	Username  string `json:"username" gorm:"column:username"`
	Phone     string `json:"phone" gorm:"column:phone"`
	Avatar    string `json:"avatar,omitempty" gorm:"column:avatar"`
	CreatedAt int64  `json:"createdAt" gorm:"column:created_at"`
	Password  string `json:"-" gorm:"column:password_hash"`
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
