package repository

import (
	"colorai-backend/model/entity"
	"colorai-backend/model/response"
	"encoding/json"

	"gorm.io/gorm"
)

// KnowledgeRepository 知识库数据访问接口
type KnowledgeRepository interface {
	GetColorIssues(keyword string) ([]response.QAItem, error)
	GetPhotoTips() ([]response.QAItem, error)
	GetShops(city string) ([]response.Shop, error)
	GetBrands(category string) ([]response.Brand, error)
}

// mysqlKnowledgeRepository MySQL 知识库数据访问实现
type mysqlKnowledgeRepository struct {
	db *gorm.DB
}

// NewKnowledgeRepository 创建 KnowledgeRepository 实例
func NewKnowledgeRepository(db *gorm.DB) KnowledgeRepository {
	return &mysqlKnowledgeRepository{db: db}
}

func (r *mysqlKnowledgeRepository) GetColorIssues(keyword string) ([]response.QAItem, error) {
	var items []entity.ColorIssue
	query := r.db

	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("question LIKE ? OR answer LIKE ? OR category LIKE ?", like, like, like)
	}

	if err := query.Find(&items).Error; err != nil {
		return nil, err
	}

	return convertColorIssues(items), nil
}

func (r *mysqlKnowledgeRepository) GetPhotoTips() ([]response.QAItem, error) {
	var items []entity.PhotoTip
	if err := r.db.Find(&items).Error; err != nil {
		return nil, err
	}
	return convertPhotoTips(items), nil
}

func (r *mysqlKnowledgeRepository) GetShops(city string) ([]response.Shop, error) {
	var shops []entity.ShopDB
	query := r.db

	if city != "" && city != "all" && city != "全部城市" {
		query = query.Where("city = ?", city)
	}

	if err := query.Find(&shops).Error; err != nil {
		return nil, err
	}

	return convertShops(shops), nil
}

func (r *mysqlKnowledgeRepository) GetBrands(category string) ([]response.Brand, error) {
	var brands []entity.BrandDB
	query := r.db

	if category != "" && category != "all" && category != "全部" {
		// 使用 JSON_CONTAINS 查询包含指定分类的品牌
		query = query.Where("JSON_CONTAINS(category, ?)", "\""+category+"\"")
	}

	if err := query.Find(&brands).Error; err != nil {
		return nil, err
	}

	return convertBrands(brands), nil
}

// 转换函数
func convertColorIssues(items []entity.ColorIssue) []response.QAItem {
	result := make([]response.QAItem, 0, len(items))
	for _, item := range items {
		qaItem := response.QAItem{
			ID:       item.ID,
			Question: item.Question,
			Answer:   item.Answer,
			Category: item.Category,
		}
		// 解析 JSON tags
		if item.Tags != "" && item.Tags != "null" {
			_ = json.Unmarshal([]byte(item.Tags), &qaItem.Tags)
		}
		result = append(result, qaItem)
	}
	return result
}

func convertPhotoTips(items []entity.PhotoTip) []response.QAItem {
	result := make([]response.QAItem, 0, len(items))
	for _, item := range items {
		qaItem := response.QAItem{
			ID:       item.ID,
			Question: item.Question,
			Answer:   item.Answer,
			Category: item.Category,
		}
		// 解析 JSON tags
		if item.Tags != "" && item.Tags != "null" {
			_ = json.Unmarshal([]byte(item.Tags), &qaItem.Tags)
		}
		result = append(result, qaItem)
	}
	return result
}

func convertShops(shops []entity.ShopDB) []response.Shop {
	result := make([]response.Shop, 0, len(shops))
	for _, shop := range shops {
		s := response.Shop{
			ID:      shop.ID,
			Name:    shop.Name,
			Address: shop.Address,
			City:    shop.City,
			Phone:   shop.Phone,
			Rating:  shop.Rating,
		}
		// 解析 JSON products
		if shop.Products != "" && shop.Products != "null" {
			_ = json.Unmarshal([]byte(shop.Products), &s.Products)
		}
		result = append(result, s)
	}
	return result
}

func convertBrands(brands []entity.BrandDB) []response.Brand {
	result := make([]response.Brand, 0, len(brands))
	for _, brand := range brands {
		b := response.Brand{
			ID:          brand.ID,
			Name:        brand.Name,
			Initial:     brand.Initial,
			Rating:      brand.Rating,
			Description: brand.Description,
			Website:     brand.Website,
		}
		// 解析 JSON category
		if brand.Category != "" && brand.Category != "null" {
			_ = json.Unmarshal([]byte(brand.Category), &b.Category)
		}
		result = append(result, b)
	}
	return result
}
