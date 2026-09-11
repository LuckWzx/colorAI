package entity

// ============================================================
// 通用响应
// ============================================================

type SuccessResponse struct {
	Success bool `json:"success"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}
