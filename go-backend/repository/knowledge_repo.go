package repository

import (
	"database/sql"
	"encoding/json"

	"colorai-backend/models"
)

// KnowledgeRepository 知识库数据访问接口
type KnowledgeRepository interface {
	GetColorIssues(keyword string) ([]models.QAItem, error)
	GetPhotoTips() ([]models.QAItem, error)
	GetShops(city string) ([]models.Shop, error)
	GetBrands(category string) ([]models.Brand, error)
}

// mysqlKnowledgeRepository MySQL 知识库数据访问实现
type mysqlKnowledgeRepository struct {
	db *sql.DB
}

// NewKnowledgeRepository 创建 KnowledgeRepository 实例
func NewKnowledgeRepository(db *sql.DB) KnowledgeRepository {
	return &mysqlKnowledgeRepository{db: db}
}

func (r *mysqlKnowledgeRepository) GetColorIssues(keyword string) ([]models.QAItem, error) {
	var rows *sql.Rows
	var err error

	if keyword == "" {
		rows, err = r.db.Query("SELECT id, question, answer, category, tags FROM color_issues")
	} else {
		like := "%" + keyword + "%"
		rows, err = r.db.Query(
			"SELECT id, question, answer, category, tags FROM color_issues "+
				"WHERE question LIKE ? OR answer LIKE ? OR category LIKE ? OR JSON_CONTAINS(tags, ?)",
			like, like, like, "\""+keyword+"\"")
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanQAItems(rows)
}

func (r *mysqlKnowledgeRepository) GetPhotoTips() ([]models.QAItem, error) {
	rows, err := r.db.Query("SELECT id, question, answer, category, tags FROM photo_tips")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanQAItems(rows)
}

func (r *mysqlKnowledgeRepository) GetShops(city string) ([]models.Shop, error) {
	var rows *sql.Rows
	var err error

	if city == "" || city == "all" || city == "全部城市" {
		rows, err = r.db.Query("SELECT id, name, address, city, phone, products, rating FROM shops")
	} else {
		rows, err = r.db.Query("SELECT id, name, address, city, phone, products, rating FROM shops WHERE city = ?", city)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.Shop
	for rows.Next() {
		var s models.Shop
		var productsJSON []byte
		if err := rows.Scan(&s.ID, &s.Name, &s.Address, &s.City, &s.Phone, &productsJSON, &s.Rating); err != nil {
			continue
		}
		if productsJSON != nil {
			_ = json.Unmarshal(productsJSON, &s.Products)
		}
		result = append(result, s)
	}
	return result, nil
}

func (r *mysqlKnowledgeRepository) GetBrands(category string) ([]models.Brand, error) {
	var rows *sql.Rows
	var err error

	if category == "" || category == "all" || category == "全部" {
		rows, err = r.db.Query("SELECT id, name, initial, rating, category, description, website FROM brands")
	} else {
		rows, err = r.db.Query(
			"SELECT id, name, initial, rating, category, description, website FROM brands "+
				"WHERE JSON_CONTAINS(category, ?)",
			"\""+category+"\"")
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.Brand
	for rows.Next() {
		var b models.Brand
		var categoryJSON []byte
		if err := rows.Scan(&b.ID, &b.Name, &b.Initial, &b.Rating, &categoryJSON, &b.Description, &b.Website); err != nil {
			continue
		}
		if categoryJSON != nil {
			_ = json.Unmarshal(categoryJSON, &b.Category)
		}
		result = append(result, b)
	}
	return result, nil
}

// scanQAItems 从行集中扫描 QAItem 列表
func scanQAItems(rows *sql.Rows) ([]models.QAItem, error) {
	var result []models.QAItem
	for rows.Next() {
		var item models.QAItem
		var tagsJSON []byte
		err := rows.Scan(&item.ID, &item.Question, &item.Answer, &item.Category, &tagsJSON)
		if err != nil {
			continue
		}
		if tagsJSON != nil {
			_ = json.Unmarshal(tagsJSON, &item.Tags)
		}
		result = append(result, item)
	}
	return result, nil
}

