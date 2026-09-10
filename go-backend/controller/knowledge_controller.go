package controller

import (
	"colorai-backend/service"

	"github.com/gin-gonic/gin"
)

// KnowledgeController 知识库 HTTP 处理器
type KnowledgeController struct {
	knowledgeSvc service.KnowledgeService
}

// NewKnowledgeController 创建 KnowledgeController 实例
func NewKnowledgeController(knowledgeSvc service.KnowledgeService) *KnowledgeController {
	return &KnowledgeController{knowledgeSvc: knowledgeSvc}
}

// KnowledgeColorIssues 偏色问题问答
// GET /api/knowledge/color-issues?keyword=xxx
func (h *KnowledgeController) KnowledgeColorIssues(c *gin.Context) {
	keyword := c.Query("keyword")

	items, err := h.knowledgeSvc.GetColorIssues(keyword)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"items": items, "total": len(items)})
}

// KnowledgePhotoTips 拍照技巧
// GET /api/knowledge/photo-tips
func (h *KnowledgeController) KnowledgePhotoTips(c *gin.Context) {
	items, err := h.knowledgeSvc.GetPhotoTips()
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"items": items, "total": len(items)})
}

// KnowledgeShops 附近商铺
// GET /api/knowledge/shops?city=xxx
func (h *KnowledgeController) KnowledgeShops(c *gin.Context) {
	city := c.Query("city")

	items, err := h.knowledgeSvc.GetShops(city)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"items": items, "total": len(items)})
}

// KnowledgeBrands 品牌大全
// GET /api/knowledge/brands?category=xxx
func (h *KnowledgeController) KnowledgeBrands(c *gin.Context) {
	category := c.Query("category")

	items, err := h.knowledgeSvc.GetBrands(category)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"items": items, "total": len(items)})
}
