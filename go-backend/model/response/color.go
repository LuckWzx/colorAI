package response

// ============================================================
// 颜色处理 - API 响应体
// ============================================================

// RGB RGB 颜色值
type RGB struct {
	R int `json:"r"`
	G int `json:"g"`
	B int `json:"b"`
}

// CorrectMeta 校色元数据
type CorrectMeta struct {
	Brightness  int `json:"brightness"`
	Contrast    int `json:"contrast"`
	Saturation  int `json:"saturation"`
	Temperature int `json:"temperature"`
}

// CorrectResponse 图片校色响应
type CorrectResponse struct {
	Success      bool        `json:"success"`
	OriginalURL  string      `json:"originalUrl"`
	CorrectedURL string      `json:"correctedUrl"`
	Meta         CorrectMeta `json:"meta"`
}

// PickResponse 智能取色响应
type PickResponse struct {
	Success  bool   `json:"success"`
	Hex      string `json:"hex"`
	RGB      RGB    `json:"rgb"`
	Name     string `json:"name"`
	Category string `json:"category"`
}

// CompareImages 对比图片
type CompareImages struct {
	ImageA string `json:"imageA"`
	ImageB string `json:"imageB"`
}

// CompareDetails 对比详情
type CompareDetails struct {
	BrightnessDiff float64 `json:"brightnessDiff"`
	ColorDiff      float64 `json:"colorDiff"`
	SaturationDiff float64 `json:"saturationDiff"`
}

// CompareResponse 颜色对比响应
type CompareResponse struct {
	Success    bool           `json:"success"`
	Similarity float64        `json:"similarity"`
	DeltaE     float64        `json:"deltaE"`
	Pass       bool           `json:"pass"`
	Images     CompareImages  `json:"images"`
	Details    CompareDetails `json:"details"`
}

// PhoneAdjustment 手机校色调整参数
type PhoneAdjustment struct {
	RedChannel           int     `json:"redChannel"`
	GreenChannel         int     `json:"greenChannel"`
	BlueChannel          int     `json:"blueChannel"`
	Brightness           int     `json:"brightness"`
	ExposureCompensation float64 `json:"exposureCompensation"`
}

// PhoneCorrectResponse 手机拍摄校色响应
type PhoneCorrectResponse struct {
	Success              bool            `json:"success"`
	OriginalURL          string          `json:"originalUrl"`
	VisualCorrectedURL   string          `json:"visualCorrectedUrl"`
	StandardCorrectedURL string          `json:"standardCorrectedUrl"`
	Adjustment           PhoneAdjustment `json:"adjustment"`
}
