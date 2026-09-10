package controller

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"colorai-backend/models"
	"colorai-backend/service"

	"github.com/gin-gonic/gin"
)

// ColorController 色彩处理 HTTP 处理器
type ColorController struct {
	colorSvc service.ColorService
}

// NewColorController 创建 ColorController 实例
func NewColorController(colorSvc service.ColorService) *ColorController {
	return &ColorController{colorSvc: colorSvc}
}

// ColorPick 智能取色
// POST /api/color/pick
func (h *ColorController) ColorPick(c *gin.Context) {
	var req models.PickRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	resp, err := h.colorSvc.PickColor(req.ImageURL, req.X, req.Y)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{
		"hex":      resp.Hex,
		"rgb":      resp.RGB,
		"name":     resp.Name,
		"category": resp.Category,
	})
}

// ColorCorrect 图片一键校正
// POST /api/color/correct
func (h *ColorController) ColorCorrect(c *gin.Context) {
	imageURL := saveUploadedFile(c, "image")

	resp, err := h.colorSvc.CorrectImage(imageURL)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{
		"originalUrl":  resp.OriginalURL,
		"correctedUrl": resp.CorrectedURL,
		"meta":         resp.Meta,
	})
}

// ColorCompare 颜色相似度对比
// POST /api/color/compare
func (h *ColorController) ColorCompare(c *gin.Context) {
	urlA := saveUploadedFile(c, "imageA")
	urlB := saveUploadedFile(c, "imageB")

	resp, err := h.colorSvc.CompareImages(urlA, urlB)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{
		"similarity": resp.Similarity,
		"deltaE":     resp.DeltaE,
		"pass":       resp.Pass,
		"images":     resp.Images,
		"details":    resp.Details,
	})
}

// ColorPhoneCorrect 手机拍摄校色
// POST /api/color/phone-correct
func (h *ColorController) ColorPhoneCorrect(c *gin.Context) {
	imageURL := saveUploadedFile(c, "image")

	resp, err := h.colorSvc.PhoneCorrect(imageURL)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{
		"originalUrl":          resp.OriginalURL,
		"visualCorrectedUrl":   resp.VisualCorrectedURL,
		"standardCorrectedUrl": resp.StandardCorrectedURL,
		"adjustment":           resp.Adjustment,
	})
}

// saveUploadedFile 保存上传文件，返回 URL 路径
func saveUploadedFile(c *gin.Context, fieldName string) string {
	file, err := c.FormFile(fieldName)
	if err != nil {
		return "/uploads/placeholder.jpg"
	}

	// 确保 uploads 目录存在
	uploadsDir := "uploads"
	_ = os.MkdirAll(uploadsDir, 0755)

	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	filename := fmt.Sprintf("%d-%s-%d%s", time.Now().UnixNano(), fieldName, cryptoRandInt(1000, 9999), ext)
	savePath := filepath.Join(uploadsDir, filename)

	if err := c.SaveUploadedFile(file, savePath); err != nil {
		return "/uploads/placeholder.jpg"
	}
	return "/uploads/" + filename
}

func cryptoRandInt(min, max int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min+1)))
	return int(n.Int64()) + min
}
