package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"colorai-backend/models"

	"github.com/gin-gonic/gin"
)

// 知识数据(启动时加载到内存)
var (
	colorIssues []models.QAItem
	photoTips   []models.QAItem
	shops       []models.Shop
	brands      []models.Brand
)

func init() {
	// 从 go-backend/ 根目录加载 data/
	dataDir := "data"
	loadJSON(filepath.Join(dataDir, "color_issues.json"), &colorIssues)
	loadJSON(filepath.Join(dataDir, "photo_tips.json"), &photoTips)
	loadJSON(filepath.Join(dataDir, "shops.json"), &shops)
	loadJSON(filepath.Join(dataDir, "brands.json"), &brands)
}

// loadJSON 从文件加载 JSON 到目标切片
func loadJSON(path string, dest interface{}) {
	data, err := os.ReadFile(path)
	if err != nil {
		// 数据文件不存在时静默忽略,使用空切片
		return
	}
	_ = json.Unmarshal(data, dest)
}

// containsIgnoreCase 忽略大小写的字符串包含检查
func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// KnowledgeColorIssues 偏色问题问答
// GET /api/knowledge/color-issues?keyword=发红
func KnowledgeColorIssues(c *gin.Context) {
	keyword := c.Query("keyword")
	var result []models.QAItem

	if keyword == "" {
		result = colorIssues
	} else {
		for _, item := range colorIssues {
			if containsIgnoreCase(item.Question, keyword) ||
				containsIgnoreCase(item.Answer, keyword) ||
				containsIgnoreCase(item.Category, keyword) ||
				tagsContains(item.Tags, keyword) {
				result = append(result, item)
			}
		}
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
	c.JSON(http.StatusOK, models.ListResponse[models.QAItem]{
		Success: true,
		Items:   photoTips,
		Total:   len(photoTips),
	})
}

// KnowledgeShops 附近商铺
// GET /api/knowledge/shops?city=深圳
func KnowledgeShops(c *gin.Context) {
	city := c.Query("city")
	var result []models.Shop

	if city == "" || city == "all" || city == "全部城市" {
		result = shops
	} else {
		for _, s := range shops {
			if s.City == city {
				result = append(result, s)
			}
		}
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
	var result []models.Brand

	if category == "" || category == "all" || category == "全部" {
		result = brands
	} else {
		for _, b := range brands {
			for _, cat := range b.Category {
				if strings.Contains(cat, category) {
					result = append(result, b)
					break
				}
			}
		}
	}

	c.JSON(http.StatusOK, models.ListResponse[models.Brand]{
		Success: true,
		Items:   result,
		Total:   len(result),
	})
}

// tagsContains 检查标签数组中是否包含关键词
func tagsContains(tags []string, keyword string) bool {
	for _, t := range tags {
		if containsIgnoreCase(t, keyword) {
			return true
		}
	}
	return false
}
