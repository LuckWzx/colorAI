package entity

// ============================================================
// 颜色处理
// ============================================================

type RGB struct {
	R int `json:"r"`
	G int `json:"g"`
	B int `json:"b"`
}

type CorrectMeta struct {
	Brightness  int `json:"brightness"`
	Contrast    int `json:"contrast"`
	Saturation  int `json:"saturation"`
	Temperature int `json:"temperature"`
}

type CorrectResponse struct {
	Success      bool        `json:"success"`
	OriginalURL  string      `json:"originalUrl"`
	CorrectedURL string      `json:"correctedUrl"`
	Meta         CorrectMeta `json:"meta"`
}

type PickRequest struct {
	ImageURL string  `json:"imageUrl"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

type PickResponse struct {
	Success  bool   `json:"success"`
	Hex      string `json:"hex"`
	RGB      RGB    `json:"rgb"`
	Name     string `json:"name"`
	Category string `json:"category"`
}

type CompareImages struct {
	ImageA string `json:"imageA"`
	ImageB string `json:"imageB"`
}

type CompareDetails struct {
	BrightnessDiff float64 `json:"brightnessDiff"`
	ColorDiff      float64 `json:"colorDiff"`
	SaturationDiff float64 `json:"saturationDiff"`
}

type CompareResponse struct {
	Success    bool           `json:"success"`
	Similarity float64        `json:"similarity"`
	DeltaE     float64        `json:"deltaE"`
	Pass       bool           `json:"pass"`
	Images     CompareImages  `json:"images"`
	Details    CompareDetails `json:"details"`
}

type PhoneAdjustment struct {
	RedChannel           int     `json:"redChannel"`
	GreenChannel         int     `json:"greenChannel"`
	BlueChannel          int     `json:"blueChannel"`
	Brightness           int     `json:"brightness"`
	ExposureCompensation float64 `json:"exposureCompensation"`
}

type PhoneCorrectResponse struct {
	Success              bool            `json:"success"`
	OriginalURL          string          `json:"originalUrl"`
	VisualCorrectedURL   string          `json:"visualCorrectedUrl"`
	StandardCorrectedURL string          `json:"standardCorrectedUrl"`
	Adjustment           PhoneAdjustment `json:"adjustment"`
}
