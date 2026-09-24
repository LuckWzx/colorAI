package storage

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

// ---------------------------------------------------------------------------
// oss 驱动：上传到阿里云 OSS
//
// 三条前提（2026-09-24 与用户确认）：
//
//  1. **bucket 为公共读**，URL 直接拼域名、不带签名 —— agent 的 image_correction
//     会 httpx.get(image_url) 下载图片，私有 bucket 直接 403。
//     安全性由 object key 里的 8 字节随机串承担（见 key.go）。
//     若 bucket 实际是私有的，改用 SignedURL（接口已提供）。
//
//  2. **上传 endpoint 与对外访问域名是两回事**：前者可用内网省流量费，
//     后者必须是公网域名，否则浏览器与 agent 都取不到图。
//
//  3. **Content-Type 必须显式设置**：OSS 推断不出会落到 application/octet-stream，
//     而下游按 content-type 判断类型的服务会拒收。
// ---------------------------------------------------------------------------

type ossStorage struct {
	bucket     *oss.Bucket
	publicBase string
	maxBytes   int64
}

func newOSS(cfg Config) (Storage, error) {
	// 只校验「配置是否齐全」。bucket 是否存在、凭据是否有效，都要等 Put 才暴露 ——
	// oss.New 与 client.Bucket 都不发网络请求。
	if cfg.OSSBucket == "" || cfg.OSSEndpoint == "" {
		return nil, fmt.Errorf("OSS 驱动缺少必填配置：bucket / endpoint")
	}
	if cfg.OSSAccessKeyID == "" || cfg.OSSAccessKeySecret == "" {
		return nil, fmt.Errorf("OSS 驱动缺少凭据：access key id / secret")
	}
	if cfg.PublicBaseURL == "" {
		return nil, fmt.Errorf("OSS 驱动必须设置 PublicBaseURL（bucket 的公网域名）")
	}

	client, err := oss.New(cfg.OSSEndpoint, cfg.OSSAccessKeyID, cfg.OSSAccessKeySecret)
	if err != nil {
		return nil, fmt.Errorf("初始化 OSS 客户端失败（检查 endpoint 与网络）: %w", err)
	}

	bucket, err := client.Bucket(cfg.OSSBucket)
	if err != nil {
		return nil, fmt.Errorf("获取 OSS bucket %q 失败（检查 bucket 名与 endpoint 的 region 是否一致）: %w",
			cfg.OSSBucket, err)
	}

	return &ossStorage{
		bucket:     bucket,
		publicBase: strings.TrimRight(cfg.PublicBaseURL, "/"),
		maxBytes:   cfg.MaxUploadBytes,
	}, nil
}

func (s *ossStorage) Put(key string, data []byte, contentType string) (string, error) {
	if err := checkSize(s.maxBytes, len(data)); err != nil {
		return "", err
	}
	if contentType == "" {
		// 空 Content-Type 会让下游认不出类型，兜底成二进制流
		contentType = "application/octet-stream"
	}

	if err := s.bucket.PutObject(key, bytes.NewReader(data), oss.ContentType(contentType)); err != nil {
		return "", fmt.Errorf("上传 OSS 失败: %w", err)
	}
	return s.URL(key), nil
}

func (s *ossStorage) PutDataURL(prefix, raw string) (string, error) {
	return uploadDataURL(s.Put, prefix, raw)
}

// Delete 删除 OSS 对象。OSS 的 DeleteObject 对不存在的对象也返回成功，天然幂等。
func (s *ossStorage) Delete(key string) error {
	if err := s.bucket.DeleteObject(key); err != nil {
		return fmt.Errorf("删除 OSS 对象失败: %w", err)
	}
	return nil
}

func (s *ossStorage) URL(key string) string {
	// 注意：**不带 UploadURLPrefix** —— 那是 local 驱动配合静态路由才需要的路径前缀，
	// OSS 的 URL 是 bucket 域名直挂 key。
	return s.publicBase + "/" + key
}

// SignedURL 生成带签名的临时 URL（bucket 私有场景用）
func (s *ossStorage) SignedURL(key string, ttl time.Duration) (string, error) {
	url, err := s.bucket.SignURL(key, oss.HTTPGet, int64(ttl.Seconds()))
	if err != nil {
		return "", fmt.Errorf("生成签名 URL 失败: %w", err)
	}
	return url, nil
}
