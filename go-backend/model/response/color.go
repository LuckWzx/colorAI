package response

// ============================================================
// 颜色处理 - 内部 Tool 响应体（供智能体调用）
// ============================================================

// CorrectMeta 校色元数据
type CorrectMeta struct {
	Brand       string  `json:"brand"`
	DeviceInfo  string  `json:"deviceInfo"`
	Distance    float64 `json:"distance"`
	Threshold   float64 `json:"threshold"`
	ElapsedTime float64 `json:"elapsedTime"`
}

// CorrectResult 单个校色结果
type CorrectResult struct {
	Corrected string  `json:"corrected"`
	Distance  float64 `json:"distance"`
	ModelName string  `json:"modelName"`
}

// CorrectResponse 图片校色响应
type CorrectResponse struct {
	Success      bool            `json:"success"`
	OriginalURL  string          `json:"originalUrl"`
	CorrectedURL string          `json:"correctedUrl"`
	Results      []CorrectResult `json:"results,omitempty"`
	Meta         CorrectMeta     `json:"meta"`
	Error        string          `json:"error,omitempty"`
}
