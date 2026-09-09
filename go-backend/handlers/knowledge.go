package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"colorai-backend/database"
	"colorai-backend/models"

	"github.com/gin-gonic/gin"
)

// containsIgnoreCase 忽略大小写的字符串包含检查
func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// scanQAItem 从行中扫描 QAItem
func scanQAItem(rows *sql.Rows) (models.QAItem, error) {
	var item models.QAItem
	var tagsJSON []byte
	err := rows.Scan(&item.ID, &item.Question, &item.Answer, &item.Category, &tagsJSON)
	if err != nil {
		return item, err
	}
	if tagsJSON != nil {
		_ = json.Unmarshal(tagsJSON, &item.Tags)
	}
	return item, nil
}

// KnowledgeColorIssues 偏色问题问答
// GET /api/knowledge/color-issues?keyword=发红
func KnowledgeColorIssues(c *gin.Context) {
	keyword := c.Query("keyword")
	var rows *sql.Rows
	var err error

	if keyword == "" {
		rows, err = database.DB.Query("SELECT id, question, answer, category, tags FROM color_issues")
	} else {
		like := "%" + keyword + "%"
		rows, err = database.DB.Query(
			"SELECT id, question, answer, category, tags FROM color_issues "+
				"WHERE question LIKE ? OR answer LIKE ? OR category LIKE ? OR JSON_CONTAINS(tags, ?)",
			like, like, like, "\""+keyword+"\"")
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var result []models.QAItem
	for rows.Next() {
		item, err := scanQAItem(rows)
		if err != nil {
			continue
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, models.ListResponse[models.QAItem]{
		Success: true,
		Items:   result,
		Total:   len(result),
	})
}

// KnowledgePhotoTips 拍照技巧
// GET /api/knowledge/photo-tips
func KnowledgePhotoTips(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, question, answer, category, tags FROM photo_tips")
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var result []models.QAItem
	for rows.Next() {
		item, err := scanQAItem(rows)
		if err != nil {
			continue
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, models.ListResponse[models.QAItem]{
		Success: true,
		Items:   result,
		Total:   len(result),
	})
}

// KnowledgeShops 附近商铺
// GET /api/knowledge/shops?city=深圳
func KnowledgeShops(c *gin.Context) {
	city := c.Query("city")
	var rows *sql.Rows
	var err error

	if city == "" || city == "all" || city == "全部城市" {
		rows, err = database.DB.Query("SELECT id, name, address, city, phone, products, rating FROM shops")
	} else {
		rows, err = database.DB.Query("SELECT id, name, address, city, phone, products, rating FROM shops WHERE city = ?", city)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: err.Error()})
		return
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

	c.JSON(http.StatusOK, models.ListResponse[models.Shop]{
		Success: true,
		Items:   result,
		Total:   len(result),
	})
}

// KnowledgeBrands 品牌大全
// GET /api/knowledge/brands?category=玻璃胶
func KnowledgeBrands(c *gin.Context) {
	category := c.Query("category")
	var rows *sql.Rows
	var err error

	if category == "" || category == "all" || category == "全部" {
		rows, err = database.DB.Query("SELECT id, name, initial, rating, category, description, website FROM brands")
	} else {
		rows, err = database.DB.Query(
			"SELECT id, name, initial, rating, category, description, website FROM brands "+
				"WHERE JSON_CONTAINS(category, ?)",
			"\""+category+"\"")
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Success: false, Error: err.Error()})
		return
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

	c.JSON(http.StatusOK, models.ListResponse[models.Brand]{
		Success: true,
		Items:   result,
		Total:   len(result),
	})
}
