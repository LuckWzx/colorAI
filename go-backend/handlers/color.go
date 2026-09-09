package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"colorai-backend/models"

	"github.com/gin-gonic/gin"
)

// uploadsDir 上传文件存储目录(从 go-backend/ 根目录加载 uploads/)
var uploadsDir = "uploads"

func init() {
	// 确保 uploads 目录存在
	_ = os.MkdirAll(uploadsDir, 0755)
}

// cryptoRandInt 返回 [min, max] 范围内的加密安全随机整数
func cryptoRandInt(min, max int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min+1)))
	return int(n.Int64()) + min
}

// randomFloat 返回 [min, max] 范围内保留 decimals 位小数的随机浮点数
func randomFloat(min, max float64, decimals int) float64 {
	scale := 1.0
	for i := 0; i < decimals; i++ {
		scale *= 10
	}
	n, _ := rand.Int(rand.Reader, big.NewInt(10000))
	frac := float64(n.Int64()) / 10000.0
	v := min + frac*(max-min)
	return float64(int(v*scale+0.5)) / scale
}

// getColorName 根据 HEX 颜色返回近似中文名称
func getColorName(hex string) string {
	// 简化的颜色名称匹配(与 Express 版一致)
	type rule struct {
		pattern string
		name    string
	}
	rules := []rule{
		{"^#[0-9a-fA-F]{2}0000$", "红色"},
		{"^#00[0-9a-fA-F]{2}00$", "绿色"},
		{"^#0000[0-9a-fA-F]{2}$", "蓝色"},
		{"^#[0-9a-fA-F]{2}[0-9a-fA-F]{2}00$", "黄色"},
		{"^#00[0-9a-fA-F]{2}[0-9a-fA-F]{2}$", "青色"},
		{"^#[0-9a-fA-F]{2}00[0-9a-fA-F]{2}$", "品红"},
		{"^#[0-9a-fA-F]{6}$", "自定义色"},
	}
	for _, r := range rules {
		if matched, _ := filepath.Match(r.pattern, hex); matched {
			return r.name
		}
	}
	return "混合色"
}

// getColorCategory 根据 RGB 值返回颜色分类
func getColorCategory(r, g, b int) string {
	maxVal := max3(r, g, b)
	minVal := min3(r, g, b)
	if maxVal-minVal < 20 {
		return "中性灰"
	}
	if maxVal == r && float64(g) > float64(b)*1.3 {
		return "暖色系"
	}
	if maxVal == r {
		return "红色系"
	}
	if maxVal == g {
		return "绿色系"
	}
	if maxVal == b && float64(r) > float64(g)*0.8 {
		return "紫色系"
	}
	return "蓝色系"
}

func max3(a, b, c int) int {
	if a >= b && a >= c {
		return a
	}
	if b >= c {
		return b
	}
	return c
}

func min3(a, b, c int) int {
	if a <= b && a <= c {
		return a
	}
	if b <= c {
		return b
	}
	return c
}

// saveUploadedFile 保存上传文件,返回 URL 路径
func saveUploadedFile(c *gin.Context, fieldName string) string {
	file, err := c.FormFile(fieldName)
	if err != nil {
		return ""
	}

	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	filename := fmt.Sprintf("%d-%s-%d%s", time.Now().UnixNano(), fieldName, cryptoRandInt(1000, 9999), ext)
	savePath := filepath.Join(uploadsDir, filename)

	if err := c.SaveUploadedFile(file, savePath); err != nil {
		return ""
	}
	return "/uploads/" + filename
}

// ColorCorrect 图片一键校正
// POST /api/color/correct
func ColorCorrect(c *gin.Context) {
	imageURL := saveUploadedFile(c, "image")
	if imageURL == "" {
		imageURL = "/uploads/placeholder.jpg"
	}

	c.JSON(http.StatusOK, models.CorrectResponse{
		Success:      true,
		OriginalURL:  imageURL,
		CorrectedURL: imageURL, // mock: 返回同一图片
		Meta: models.CorrectMeta{
			Brightness:  cryptoRandInt(-5, 15),
			Contrast:    cryptoRandInt(5, 25),
			Saturation:  cryptoRandInt(-5, 15),
			Temperature: cryptoRandInt(-15, 15),
		},
	})
}

// ColorPick 智能取色
// POST /api/color/pick
func ColorPick(c *gin.Context) {
	var req models.PickRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success: false,
			Error:   "Invalid request body",
		})
		return
	}

	r := cryptoRandInt(0, 255)
	g := cryptoRandInt(0, 255)
	b := cryptoRandInt(0, 255)
	hex := fmt.Sprintf("#%02X%02X%02X", r, g, b)

	c.JSON(http.StatusOK, models.PickResponse{
		Success:  true,
		Hex:      hex,
		RGB:      models.RGB{R: r, G: g, B: b},
		Name:     getColorName(hex),
		Category: getColorCategory(r, g, b),
	})
}

// ColorCompare 颜色相似度对比
// POST /api/color/compare
func ColorCompare(c *gin.Context) {
	urlA := saveUploadedFile(c, "imageA")
	urlB := saveUploadedFile(c, "imageB")

	similarity := randomFloat(60, 98, 1)
	deltaE := randomFloat(0.3, 8, 2)

	c.JSON(http.StatusOK, models.CompareResponse{
		Success:    true,
		Similarity: similarity,
		DeltaE:     deltaE,
		Pass:       deltaE <= 3,
		Images: models.CompareImages{
			ImageA: urlA,
			ImageB: urlB,
		},
		Details: models.CompareDetails{
			BrightnessDiff: randomFloat(-10, 10, 2),
			ColorDiff:      randomFloat(0.5, 10, 2),
			SaturationDiff: randomFloat(-8, 8, 2),
		},
	})
}

// ColorPhoneCorrect 手机拍摄校色
// POST /api/color/phone-correct
func ColorPhoneCorrect(c *gin.Context) {
	imageURL := saveUploadedFile(c, "image")
	if imageURL == "" {
		imageURL = "/uploads/placeholder.jpg"
	}

	c.JSON(http.StatusOK, models.PhoneCorrectResponse{
		Success:              true,
		OriginalURL:          imageURL,
		VisualCorrectedURL:   imageURL,
		StandardCorrectedURL: imageURL,
		Adjustment: models.PhoneAdjustment{
			RedChannel:           cryptoRandInt(-8, 12),
			GreenChannel:         cryptoRandInt(-10, 8),
			BlueChannel:          cryptoRandInt(-12, 10),
			Brightness:           cryptoRandInt(3, 18),
			ExposureCompensation: randomFloat(0.2, 1.0, 1),
		},
	})
}
