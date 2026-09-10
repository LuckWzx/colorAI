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

// ============================================================
// AI 对话代理
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

// ============================================================
// 会话管理
// ============================================================

// ChatSession 会话元数据（列表接口用）
type ChatSession struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
	MessageCount int    `json:"messageCount"`
}

// ChatSessionDetail 会话详情（含消息历史）
type ChatSessionDetail struct {
	ChatSession
	Messages interface{} `json:"messages,omitempty"`
	History  interface{} `json:"history,omitempty"`
}

// SaveSessionRequest 保存会话请求体
type SaveSessionRequest struct {
	Title    string      `json:"title"`
	Messages interface{} `json:"messages,omitempty"`
	History  interface{} `json:"history,omitempty"`
}
