package entity

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
