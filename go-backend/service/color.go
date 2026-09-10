package service

import (
	"crypto/rand"
	"fmt"
	"math/big"

	"colorai-backend/models"
)

// ColorService 色彩处理业务接口
type ColorService interface {
	PickColor(imageURL string, x, y float64) (*models.PickResponse, error)
	CorrectImage(imageURL string) (*models.CorrectResponse, error)
	CompareImages(urlA, urlB string) (*models.CompareResponse, error)
	PhoneCorrect(imageURL string) (*models.PhoneCorrectResponse, error)
}

// mockColorService Mock 色彩处理实现（后续对接真实服务时替换此实现）
type mockColorService struct{}

// NewColorService 创建 ColorService 实例（当前为 Mock 实现）
func NewColorService() ColorService {
	return &mockColorService{}
}

func (s *mockColorService) PickColor(imageURL string, x, y float64) (*models.PickResponse, error) {
	r := cryptoRandInt(0, 255)
	g := cryptoRandInt(0, 255)
	b := cryptoRandInt(0, 255)
	hex := fmt.Sprintf("#%02X%02X%02X", r, g, b)

	return &models.PickResponse{
		Success:  true,
		Hex:      hex,
		RGB:      models.RGB{R: r, G: g, B: b},
		Name:     getColorName(hex),
		Category: getColorCategory(r, g, b),
	}, nil
}

func (s *mockColorService) CorrectImage(imageURL string) (*models.CorrectResponse, error) {
	return &models.CorrectResponse{
		Success:      true,
		OriginalURL:  imageURL,
		CorrectedURL: imageURL,
		Meta: models.CorrectMeta{
			Brightness:  cryptoRandInt(-5, 15),
			Contrast:    cryptoRandInt(5, 25),
			Saturation:  cryptoRandInt(-5, 15),
			Temperature: cryptoRandInt(-15, 15),
		},
	}, nil
}

func (s *mockColorService) CompareImages(urlA, urlB string) (*models.CompareResponse, error) {
	similarity := randomFloat(60, 98, 1)
	deltaE := randomFloat(0.3, 8, 2)

	return &models.CompareResponse{
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
	}, nil
}

func (s *mockColorService) PhoneCorrect(imageURL string) (*models.PhoneCorrectResponse, error) {
	return &models.PhoneCorrectResponse{
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
	}, nil
}

// ============================================================
// 辅助函数
// ============================================================

func cryptoRandInt(min, max int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min+1)))
	return int(n.Int64()) + min
}

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

func getColorName(hex string) string {
	type rule struct {
		pattern string
		name    string
	}
	rules := []rule{
		{"#[0-9a-fA-F]{2}0000", "红色"},
		{"#00[0-9a-fA-F]{2}00", "绿色"},
		{"#0000[0-9a-fA-F]{2}", "蓝色"},
		{"#[0-9a-fA-F]{2}[0-9a-fA-F]{2}00", "黄色"},
		{"#00[0-9a-fA-F]{2}[0-9a-fA-F]{2}", "青色"},
		{"#[0-9a-fA-F]{2}00[0-9a-fA-F]{2}", "品红"},
	}
	for _, r := range rules {
		if len(hex) == 7 {
			// 简单模式匹配
			match := true
			for i := 1; i < 7; i++ {
				p := r.pattern[i]
				c := hex[i]
				if p == '0' && c != '0' {
					match = false
					break
				}
				if p == '[' {
					// 跳过字符类
					continue
				}
			}
			if match {
				return r.name
			}
		}
	}
	return "自定义色"
}

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
