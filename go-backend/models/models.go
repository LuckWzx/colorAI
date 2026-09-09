package models

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

// ============================================================
// 知识数据
// ============================================================

type QAItem struct {
	ID       string   `json:"id"`
	Question string   `json:"question"`
	Answer   string   `json:"answer"`
	Category string   `json:"category,omitempty"`
	Tags     []string `json:"tags,omitempty"`
	Level    int      `json:"level,omitempty"`
}

type Shop struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Address  string   `json:"address"`
	City     string   `json:"city"`
	Phone    string   `json:"phone"`
	Products []string `json:"products"`
	Rating   float64  `json:"rating"`
}

type Brand struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Initial     string   `json:"initial"`
	Rating      float64  `json:"rating"`
	Category    []string `json:"category"`
	Description string   `json:"description"`
	Website     string   `json:"website"`
}

type ListResponse[T any] struct {
	Success bool `json:"success"`
	Items   []T  `json:"items"`
	Total   int  `json:"total"`
}

// ============================================================
// DeepSeek 代理
// ============================================================

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Messages []ChatMessage `json:"messages"`
	Model    string        `json:"model,omitempty"`
}

type ChatChoice struct {
	Message ChatMessage `json:"message"`
}

type ChatUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

type ChatResponse struct {
	Success bool         `json:"success"`
	Choices []ChatChoice `json:"choices"`
	Model   string       `json:"model"`
	Usage   *ChatUsage   `json:"usage,omitempty"`
	Error   string       `json:"error,omitempty"`
}
