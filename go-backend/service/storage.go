package service

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"colorai-backend/config"
)

// UploadURLPrefix 图片对外的 URL 路径前缀。
// **必须与 router.go 里 r.Static(...) 注册的前缀一致** —— router.go 已改为
// 从 config.Storage.LocalDir 取目录，两边不会再各自漂移。
const UploadURLPrefix = "/uploads"

// Storage 文件存储抽象。
//
// 目前只有 local 驱动。后期接阿里云 OSS 时新增一个实现、在 NewStorage 里加一个
// case 即可，调用方（chat_service）不需要任何改动 —— 因为 URL 前缀走
// config.StorageConfig.PublicBaseURL，切换只改配置。
type Storage interface {
	// SaveDataURL 把前端传来的 dataURL 落盘，返回可公开访问的完整 URL。
	// 传入的已经是 http(s) URL 时原样返回，保证幂等。
	SaveDataURL(raw string) (string, error)
}

// NewStorage 按配置创建存储实现
func NewStorage(cfg config.StorageConfig) Storage {
	switch cfg.Driver {
	// case "oss":
	// 	return newOSSStorage(cfg)
	default:
		return &localStorage{
			root:       cfg.LocalDir,
			publicBase: cfg.PublicBaseURL,
			maxBytes:   cfg.MaxUploadBytes,
		}
	}
}

// ---------------------------------------------------------------------------
// local 驱动：存本地磁盘，由 Gin 的静态路由对外提供
// ---------------------------------------------------------------------------

type localStorage struct {
	root       string
	publicBase string
	maxBytes   int64
}

func (s *localStorage) SaveDataURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("图片数据为空")
	}

	// 已经是 URL —— 前端复用历史消息时会带上，原样返回保证幂等
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw, nil
	}
	if !strings.HasPrefix(raw, "data:") {
		return "", fmt.Errorf("不支持的图片格式：既不是 dataURL 也不是 http(s) URL")
	}

	data, ext, err := decodeDataURL(raw)
	if err != nil {
		return "", err
	}
	if s.maxBytes > 0 && int64(len(data)) > s.maxBytes {
		return "", fmt.Errorf("图片过大（%.1fMB），上限 %.1fMB",
			float64(len(data))/1024/1024, float64(s.maxBytes)/1024/1024)
	}

	key := objectKey(ext)
	full := filepath.Join(s.root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return "", fmt.Errorf("创建图片目录失败: %w", err)
	}
	if err := os.WriteFile(full, data, 0o644); err != nil {
		return "", fmt.Errorf("写入图片失败: %w", err)
	}

	return s.publicBase + UploadURLPrefix + "/" + key, nil
}

// objectKey 生成 chat/2026/09/15/20260915_144509_a1b2c3d4.jpg 形式的对象键。
// 按日期分目录，方便后期做保留策略（PRD 提到原图 7 天清理）。
func objectKey(ext string) string {
	now := time.Now()
	dir := path.Join("chat", now.Format("2006"), now.Format("01"), now.Format("02"))
	return path.Join(dir, now.Format("20060102_150405")+"_"+randomHex(8)+ext)
}

// randomHex 返回 n 字节的随机十六进制串（2n 个字符）
func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand 失败极罕见，退化成纳秒时间戳，仍能保证唯一
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// decodeDataURL 解析 data:image/jpeg;base64,xxxx 形式的图片数据
func decodeDataURL(raw string) ([]byte, string, error) {
	header, payload, ok := strings.Cut(raw, ",")
	if !ok {
		return nil, "", fmt.Errorf("dataURL 格式错误：缺少逗号分隔符")
	}
	if !strings.Contains(header, "base64") {
		return nil, "", fmt.Errorf("暂不支持非 base64 编码的 dataURL")
	}

	mime := strings.TrimPrefix(header, "data:")
	mime = strings.TrimSuffix(mime, ";base64")
	mime = strings.TrimSpace(strings.Split(mime, ";")[0])

	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		// 前端可能用了不带 padding 的编码，兜一下
		data, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return nil, "", fmt.Errorf("base64 解码失败: %w", err)
		}
	}
	return data, extFromMime(mime), nil
}

// extFromMime 把 MIME 映射成文件扩展名。
// 校色接口那边按 content-type 判断，扩展名只影响 URL 观感，取不到就用 .jpg。
func extFromMime(mime string) string {
	switch mime {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/bmp":
		return ".bmp"
	case "image/heic", "image/heif":
		return ".heic"
	default:
		return ".jpg"
	}
}
