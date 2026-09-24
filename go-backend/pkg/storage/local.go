package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// local 驱动：写本地磁盘，由调用方注册静态路由对外提供
// ---------------------------------------------------------------------------

type localStorage struct {
	root       string
	publicBase string
	maxBytes   int64
}

func newLocal(cfg Config) *localStorage {
	return &localStorage{
		root:       cfg.LocalDir,
		publicBase: strings.TrimRight(cfg.PublicBaseURL, "/"),
		maxBytes:   cfg.MaxUploadBytes,
	}
}

// validateKey 拒绝会导致路径穿越的对象键。
//
// 为什么公共包要做这个：key 由**调用方**传入，本包不能假设它一定来自 ObjectKey。
// 一次 `Put("../../etc/passwd", ...)` 就能写到 root 之外 —— filepath.Join 会
// 老老实实把 .. 解析掉。对象存储是扁平结构、没有这个问题，所以只在 local 驱动校验。
func validateKey(key string) error {
	if key == "" {
		return fmt.Errorf("对象键不能为空")
	}
	if strings.Contains(key, "..") || strings.HasPrefix(key, "/") || strings.Contains(key, `\`) {
		return fmt.Errorf("非法的对象键: %q", key)
	}
	return nil
}

// Put 写本地文件。
//
// contentType 被忽略 —— 本地磁盘没有承载它的地方，调用方的静态文件服务按扩展名
// 推断类型。这是 local 与 oss 的真实差异，接口保留该参数只为统一调用方式。
func (s *localStorage) Put(key string, data []byte, _ string) (string, error) {
	if err := validateKey(key); err != nil {
		return "", err
	}
	if err := checkSize(s.maxBytes, len(data)); err != nil {
		return "", err
	}

	full := filepath.Join(s.root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return "", fmt.Errorf("创建文件目录失败: %w", err)
	}
	if err := os.WriteFile(full, data, 0o644); err != nil {
		return "", fmt.Errorf("写入文件失败: %w", err)
	}
	return s.URL(key), nil
}

func (s *localStorage) PutDataURL(prefix, raw string) (string, error) {
	return uploadDataURL(s.Put, prefix, raw)
}

// Delete 删除本地文件；文件不存在视为成功（幂等）
func (s *localStorage) Delete(key string) error {
	if err := validateKey(key); err != nil {
		return err
	}
	full := filepath.Join(s.root, filepath.FromSlash(key))
	if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("删除文件失败: %w", err)
	}
	return nil
}

func (s *localStorage) URL(key string) string {
	return s.publicBase + UploadURLPrefix + "/" + key
}

// SignedURL 本地磁盘没有签名机制 —— 静态路由本身就是公开的
func (s *localStorage) SignedURL(string, time.Duration) (string, error) {
	return "", fmt.Errorf("local 驱动不支持签名 URL")
}
