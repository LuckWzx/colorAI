package request

// ============================================================
// 颜色处理 - API 请求体
// ============================================================

// PickRequest 智能取色请求
type PickRequest struct {
	ImageURL string  `json:"imageUrl"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

// CompareRequest 颜色对比请求
type CompareRequest struct {
	ImageA string `json:"imageA"`
	ImageB string `json:"imageB"`
}
