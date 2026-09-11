package service

import (
	"bytes"
	"colorai-backend/model/entity"
	"colorai-backend/model/response"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// ColorService 色彩处理业务接口
type ColorService interface {
	PickColor(imageURL string, x, y float64) (*entity.PickResponse, error)
	CorrectImage(imageURL string) (*entity.CorrectResponse, error)
	CompareImages(urlA, urlB string) (*entity.CompareResponse, error)
	PhoneCorrect(imageURL string) (*entity.PhoneCorrectResponse, error)
}

// mockColorService Mock 色彩处理实现（后续对接真实服务时替换此实现）
type mockColorService struct{}

// realColorService 真实色彩处理实现（调用外部校色API）
type realColorService struct {
	apiURL     string
	httpClient *http.Client
}

// NewColorService 创建 ColorService 实例
// 如果设置了 COLOR_CORRECTION_API_URL 环境变量，则使用真实实现；否则使用 Mock 实现
func NewColorService() ColorService {
	apiURL := os.Getenv("COLOR_CORRECTION_API_URL")
	if apiURL != "" {
		return &realColorService{
			apiURL: apiURL,
			httpClient: &http.Client{
				Timeout: 30 * time.Second,
			},
		}
	}
	return &mockColorService{}
}

func (s *mockColorService) PickColor(imageURL string, x, y float64) (*entity.PickResponse, error) {
	r := cryptoRandInt(0, 255)
	g := cryptoRandInt(0, 255)
	b := cryptoRandInt(0, 255)
	hex := fmt.Sprintf("#%02X%02X%02X", r, g, b)

	return &entity.PickResponse{
		Success:  true,
		Hex:      hex,
		RGB:      entity.RGB{R: r, G: g, B: b},
		Name:     getColorName(hex),
		Category: getColorCategory(r, g, b),
	}, nil
}

func (s *mockColorService) CorrectImage(imageURL string) (*entity.CorrectResponse, error) {
	return &entity.CorrectResponse{
		Success:      true,
		OriginalURL:  imageURL,
		CorrectedURL: imageURL,
		Meta: entity.CorrectMeta{
			Brightness:  cryptoRandInt(-5, 15),
			Contrast:    cryptoRandInt(5, 25),
			Saturation:  cryptoRandInt(-5, 15),
			Temperature: cryptoRandInt(-15, 15),
		},
	}, nil
}

func (s *mockColorService) CompareImages(urlA, urlB string) (*entity.CompareResponse, error) {
	similarity := randomFloat(60, 98, 1)
	deltaE := randomFloat(0.3, 8, 2)

	return &entity.CompareResponse{
		Success:    true,
		Similarity: similarity,
		DeltaE:     deltaE,
		Pass:       deltaE <= 3,
		Images: entity.CompareImages{
			ImageA: urlA,
			ImageB: urlB,
		},
		Details: entity.CompareDetails{
			BrightnessDiff: randomFloat(-10, 10, 2),
			ColorDiff:      randomFloat(0.5, 10, 2),
			SaturationDiff: randomFloat(-8, 8, 2),
		},
	}, nil
}

func (s *mockColorService) PhoneCorrect(imageURL string) (*entity.PhoneCorrectResponse, error) {
	return &entity.PhoneCorrectResponse{
		Success:              true,
		OriginalURL:          imageURL,
		VisualCorrectedURL:   imageURL,
		StandardCorrectedURL: imageURL,
		Adjustment: entity.PhoneAdjustment{
			RedChannel:           cryptoRandInt(-8, 12),
			GreenChannel:         cryptoRandInt(-10, 8),
			BlueChannel:          cryptoRandInt(-12, 10),
			Brightness:           cryptoRandInt(3, 18),
			ExposureCompensation: randomFloat(0.2, 1.0, 1),
		},
	}, nil
}

// ============================================================
// realColorService 实现
// ============================================================

func (s *realColorService) CorrectImage(imageURL string) (*entity.CorrectResponse, error) {
	// 下载图片到临时文件
	tmpFile, err := downloadImageToTemp(imageURL)
	if err != nil {
		return nil, fmt.Errorf("下载图片失败: %w", err)
	}
	defer os.Remove(tmpFile)

	// 创建multipart表单
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// 添加图片文件
	file, err := os.Open(tmpFile)
	if err != nil {
		return nil, fmt.Errorf("打开临时文件失败: %w", err)
	}
	defer file.Close()

	part, err := writer.CreateFormFile("image", filepath.Base(tmpFile))
	if err != nil {
		return nil, fmt.Errorf("创建表单文件失败: %w", err)
	}

	if _, err := io.Copy(part, file); err != nil {
		return nil, fmt.Errorf("写入文件数据失败: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("关闭multipart writer失败: %w", err)
	}

	// 发送请求
	req, err := http.NewRequest("POST", s.apiURL, body)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("调用校色API失败: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	// 解析响应
	var correctionResp response.ColorCorrectionResponse
	if err := json.Unmarshal(respBody, &correctionResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	// 检查是否成功
	if !correctionResp.Passed {
		return &entity.CorrectResponse{
			Success:     false,
			OriginalURL: correctionResp.Original,
			Meta: entity.CorrectMeta{
				Brightness:  int(correctionResp.Distance * 100),
				Contrast:    int(correctionResp.Threshold * 100),
				Saturation:  0,
				Temperature: 0,
			},
		}, nil
	}

	// 构建响应
	correctedURL := ""
	if len(correctionResp.Results) > 0 {
		correctedURL = correctionResp.Results[0].Corrected
	}

	return &entity.CorrectResponse{
		Success:      true,
		OriginalURL:  correctionResp.Original,
		CorrectedURL: correctedURL,
		Meta: entity.CorrectMeta{
			Brightness:  int(correctionResp.Distance * 100),
			Contrast:    int(correctionResp.Threshold * 100),
			Saturation:  int(correctionResp.ElapsedTime),
			Temperature: 0,
		},
	}, nil
}

func (s *realColorService) PickColor(imageURL string, x, y float64) (*entity.PickResponse, error) {
	// V1版本暂不实现，使用Mock数据
	mock := &mockColorService{}
	return mock.PickColor(imageURL, x, y)
}

func (s *realColorService) CompareImages(urlA, urlB string) (*entity.CompareResponse, error) {
	// V1版本暂不实现，使用Mock数据
	mock := &mockColorService{}
	return mock.CompareImages(urlA, urlB)
}

func (s *realColorService) PhoneCorrect(imageURL string) (*entity.PhoneCorrectResponse, error) {
	// V1版本暂不实现，使用Mock数据
	mock := &mockColorService{}
	return mock.PhoneCorrect(imageURL)
}

// ============================================================
// 辅助函数
// ============================================================

// downloadImageToTemp 下载图片到临时文件
func downloadImageToTemp(imageURL string) (string, error) {
	// 创建临时文件
	tmpFile, err := os.CreateTemp("", "color-correction-*.jpg")
	if err != nil {
		return "", fmt.Errorf("创建临时文件失败: %w", err)
	}
	defer tmpFile.Close()

	// 下载图片
	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := httpClient.Get(imageURL)
	if err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("下载图片失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	if resp.StatusCode != http.StatusOK {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("下载图片失败，状态码: %d", resp.StatusCode)
	}

	// 写入临时文件
	_, err = io.Copy(tmpFile, resp.Body)
	if err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("写入临时文件失败: %w", err)
	}

	return tmpFile.Name(), nil
}

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
