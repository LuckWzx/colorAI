package response

// ============================================================
// 通用响应
// ============================================================

// SuccessResponse 成功响应
type SuccessResponse struct {
	Success bool `json:"success"`
}

// ErrorResponse 失败响应
type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

// ListResponse 通用列表响应
type ListResponse[T any] struct {
	Success bool `json:"success"`
	Items   []T  `json:"items"`
	Total   int  `json:"total"`
}
