package entity

// ============================================================
// 知识数据 - 数据库表模型
// ============================================================

// ColorIssue 颜色问题表模型（直接对应数据库 color_issues 表）
type ColorIssue struct {
	ID       string `json:"-" gorm:"column:id;primaryKey"`
	Question string `json:"-" gorm:"column:question"`
	Answer   string `json:"-" gorm:"column:answer"`
	Category string `json:"-" gorm:"column:category"`
	Tags     string `json:"-" gorm:"column:tags"` // JSON 数组
}

func (ColorIssue) TableName() string {
	return "color_issues"
}

// PhotoTip 拍照技巧表模型（直接对应数据库 photo_tips 表）
type PhotoTip struct {
	ID       string `json:"-" gorm:"column:id;primaryKey"`
	Question string `json:"-" gorm:"column:question"`
	Answer   string `json:"-" gorm:"column:answer"`
	Category string `json:"-" gorm:"column:category"`
	Tags     string `json:"-" gorm:"column:tags"` // JSON 数组
}

func (PhotoTip) TableName() string {
	return "photo_tips"
}

// ShopDB 店铺表模型（直接对应数据库 shops 表）
type ShopDB struct {
	ID       string  `json:"-" gorm:"column:id;primaryKey"`
	Name     string  `json:"-" gorm:"column:name"`
	Address  string  `json:"-" gorm:"column:address"`
	City     string  `json:"-" gorm:"column:city"`
	Phone    string  `json:"-" gorm:"column:phone"`
	Products string  `json:"-" gorm:"column:products"` // JSON 数组
	Rating   float64 `json:"-" gorm:"column:rating"`
}

func (ShopDB) TableName() string {
	return "shops"
}

// BrandDB 品牌表模型（直接对应数据库 brands 表）
type BrandDB struct {
	ID          string  `json:"-" gorm:"column:id;primaryKey"`
	Name        string  `json:"-" gorm:"column:name"`
	Initial     string  `json:"-" gorm:"column:initial"`
	Rating      float64 `json:"-" gorm:"column:rating"`
	Category    string  `json:"-" gorm:"column:category"` // JSON 数组
	Description string  `json:"-" gorm:"column:description"`
	Website     string  `json:"-" gorm:"column:website"`
}

func (BrandDB) TableName() string {
	return "brands"
}
