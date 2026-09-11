package entity

// ============================================================
// 知识数据 - 数据库表模型
// ============================================================

// ColorIssue 颜色问题表模型（直接对应数据库 color_issues 表）
type ColorIssue struct {
	ID       string `json:"id" gorm:"column:id;primaryKey"`
	Question string `json:"question" gorm:"column:question"`
	Answer   string `json:"answer" gorm:"column:answer"`
	Category string `json:"category" gorm:"column:category"`
	Tags     string `json:"tags" gorm:"column:tags"` // JSON 数组
}

func (ColorIssue) TableName() string {
	return "color_issues"
}

// PhotoTip 拍照技巧表模型（直接对应数据库 photo_tips 表）
type PhotoTip struct {
	ID       string `json:"id" gorm:"column:id;primaryKey"`
	Question string `json:"question" gorm:"column:question"`
	Answer   string `json:"answer" gorm:"column:answer"`
	Category string `json:"category" gorm:"column:category"`
	Tags     string `json:"tags" gorm:"column:tags"` // JSON 数组
}

func (PhotoTip) TableName() string {
	return "photo_tips"
}

// QAItem 知识问答项（API 响应用）
type QAItem struct {
	ID       string   `json:"id" gorm:"-"`
	Question string   `json:"question" gorm:"-"`
	Answer   string   `json:"answer" gorm:"-"`
	Category string   `json:"category,omitempty" gorm:"-"`
	Tags     []string `json:"tags,omitempty" gorm:"-"`
	Level    int      `json:"level,omitempty" gorm:"-"`
}

// Shop 店铺表模型（直接对应数据库 shops 表）
type ShopDB struct {
	ID       string  `json:"id" gorm:"column:id;primaryKey"`
	Name     string  `json:"name" gorm:"column:name"`
	Address  string  `json:"address" gorm:"column:address"`
	City     string  `json:"city" gorm:"column:city"`
	Phone    string  `json:"phone" gorm:"column:phone"`
	Products string  `json:"products" gorm:"column:products"` // JSON 数组
	Rating   float64 `json:"rating" gorm:"column:rating"`
}

func (ShopDB) TableName() string {
	return "shops"
}

// Shop 店铺（API 响应用）
type Shop struct {
	ID       string   `json:"id" gorm:"-"`
	Name     string   `json:"name" gorm:"-"`
	Address  string   `json:"address" gorm:"-"`
	City     string   `json:"city" gorm:"-"`
	Phone    string   `json:"phone" gorm:"-"`
	Products []string `json:"products" gorm:"-"`
	Rating   float64  `json:"rating" gorm:"-"`
}

// BrandDB 品牌表模型（直接对应数据库 brands 表）
type BrandDB struct {
	ID          string  `json:"id" gorm:"column:id;primaryKey"`
	Name        string  `json:"name" gorm:"column:name"`
	Initial     string  `json:"initial" gorm:"column:initial"`
	Rating      float64 `json:"rating" gorm:"column:rating"`
	Category    string  `json:"category" gorm:"column:category"` // JSON 数组
	Description string  `json:"description" gorm:"column:description"`
	Website     string  `json:"website" gorm:"column:website"`
}

func (BrandDB) TableName() string {
	return "brands"
}

// Brand 品牌（API 响应用）
type Brand struct {
	ID          string   `json:"id" gorm:"-"`
	Name        string   `json:"name" gorm:"-"`
	Initial     string   `json:"initial" gorm:"-"`
	Rating      float64  `json:"rating" gorm:"-"`
	Category    []string `json:"category" gorm:"-"`
	Description string   `json:"description" gorm:"-"`
	Website     string   `json:"website" gorm:"-"`
}

// ListResponse 通用列表响应
type ListResponse[T any] struct {
	Success bool `json:"success"`
	Items   []T  `json:"items"`
	Total   int  `json:"total"`
}
