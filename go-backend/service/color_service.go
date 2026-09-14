package service

import (
	"bytes"
	"colorai-backend/model/response"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// ColorService 色彩处理业务接口（供智能体内部 Tool 调用）
type ColorService interface {
	CorrectImage(imageURL string) (*response.CorrectResponse, error)
}

type colorService struct {
	apiURL     string
	httpClient *http.Client
}

// NewColorService 创建 ColorService 实例
// 从环境变量 COLOR_CORRECTION_API_URL 读取外部校色 API 地址
func NewColorService() ColorService {
	apiURL := os.Getenv("COLOR_CORRECTION_API_URL")
	return &colorService{
		apiURL: apiURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ============================================================
// CorrectImage 调用外部校色 API
// ============================================================

func (s *colorService) CorrectImage(imageURL string) (*response.CorrectResponse, error) {
	if s.apiURL == "" {
		return nil, fmt.Errorf("校色 API 未配置，请设置 COLOR_CORRECTION_API_URL 环境变量")
	}

	// 下载图片到临时文件
	tmpFile, err := downloadImageToTemp(imageURL)
	if err != nil {
		return nil, fmt.Errorf("下载图片失败: %w", err)
	}
	defer os.Remove(tmpFile)

	// 构建 multipart 请求
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

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
		return nil, fmt.Errorf("关闭 multipart writer 失败: %w", err)
	}

	// 发送请求
	req, err := http.NewRequest("POST", s.apiURL, body)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("调用校色 API 失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	// 解析外部 API 响应
	var apiResp response.ColorCorrectionResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	// 构建公共 meta
	meta := response.CorrectMeta{
		Brand:       apiResp.Brand,
		DeviceInfo:  apiResp.DeviceInfo,
		Distance:    apiResp.Distance,
		Threshold:   apiResp.Threshold,
		ElapsedTime: apiResp.ElapsedTime,
	}

	// 外部 API 返回错误
	if apiResp.Error != "" {
		return &response.CorrectResponse{
			Success:     false,
			OriginalURL: apiResp.Original,
			Meta:        meta,
			Error:       apiResp.Error,
		}, nil
	}

	// 校色未通过
	if !apiResp.Passed {
		return &response.CorrectResponse{
			Success:     false,
			OriginalURL: apiResp.Original,
			Meta:        meta,
			Error:       fmt.Sprintf("校色未通过，色差: %.4f，阈值: %.4f", apiResp.Distance, apiResp.Threshold),
		}, nil
	}

	// 取校色后的图片 URL
	correctedURL := ""
	var results []response.CorrectResult
	for _, r := range apiResp.Results {
		results = append(results, response.CorrectResult{
			Corrected: r.Corrected,
			Distance:  r.Distance,
			ModelName: r.ModelName,
		})
	}
	if len(apiResp.Results) > 0 {
		correctedURL = apiResp.Results[0].Corrected
	}
	if correctedURL == "" {
		return &response.CorrectResponse{
			Success:     false,
			OriginalURL: apiResp.Original,
			Meta:        meta,
			Error:       "校色 API 未返回校正后的图片",
		}, nil
	}

	return &response.CorrectResponse{
		Success:      true,
		OriginalURL:  apiResp.Original,
		CorrectedURL: correctedURL,
		Results:      results,
		Meta:         meta,
	}, nil
}

// ============================================================
// 辅助函数
// ============================================================

func downloadImageToTemp(imageURL string) (string, error) {
	tmpFile, err := os.CreateTemp("", "color-correction-*.jpg")
	if err != nil {
		return "", fmt.Errorf("创建临时文件失败: %w", err)
	}
	defer tmpFile.Close()

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Get(imageURL)
	if err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("下载图片失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("下载图片失败，状态码: %d", resp.StatusCode)
	}

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("写入临时文件失败: %w", err)
	}

	return tmpFile.Name(), nil
}
