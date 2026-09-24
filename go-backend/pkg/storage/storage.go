// Package storage 提供与业务无关的文件存储抽象。
//
// 两个驱动：local（写本地磁盘，由调用方注册静态路由对外提供）与 oss（阿里云 OSS）。
// 调用方只依赖 Storage 接口，切换驱动不改调用方。
//
// 这个包**刻意不引用项目内任何其他包**（不 import colorai-backend/config）：
// 配置由调用方转换成本包的 Config 传入。目的是让它能整体复制到别的项目复用 ——
// 这正是把它从 service/ 提到 pkg/ 的原因。
package storage

import (
	"fmt"
	"strings"
	"time"
)

// Driver 存储驱动类型
type Driver string

const (
	// DriverLocal 本地磁盘驱动
	DriverLocal Driver = "local"
	// DriverOSS 阿里云 OSS 驱动
	DriverOSS Driver = "oss"
)

// UploadURLPrefix 本地驱动对外提供静态文件的路径前缀。
//
// 这是 local 驱动的实现细节，之所以导出，是因为调用方要用它注册静态路由
// （gin 的 r.Static(prefix, dir)）—— 两边必须共用同一个常量，否则 URL 拼出来打不开。
// oss 驱动不使用它。
const UploadURLPrefix = "/uploads"

// Config 存储配置。
//
// PublicBaseURL 的语义**随驱动变化**，这是最容易配错的一处：
//   - local：站点基地址，最终 URL = PublicBaseURL + UploadURLPrefix + "/" + key
//   - oss：  bucket 的公网域名，最终 URL = PublicBaseURL + "/" + key
type Config struct {
	// Driver 驱动类型；留空等同 local
	Driver Driver
	// LocalDir 本地存储根目录（仅 local 驱动使用）
	LocalDir string
	// PublicBaseURL 对外访问 URL 前缀，语义见上
	PublicBaseURL string
	// MaxUploadBytes 单个对象大小上限（字节）；0 表示不限制
	MaxUploadBytes int64

	// —— 以下四项仅 oss 驱动使用 ——

	// OSSBucket bucket 名称
	OSSBucket string
	// OSSEndpoint 上传用的 endpoint。它与 PublicBaseURL 是两回事：
	// 与 bucket 同 region 的 ECS 可用内网域名省流量费，本地开发必须用公网域名。
	OSSEndpoint string
	// OSSAccessKeyID / OSSAccessKeySecret 建议用 RAM 子账号并只授予该 bucket 的写权限，
	// 不要用主账号 AK（主账号 AK 泄露等于整个账号失守）。
	OSSAccessKeyID     string
	OSSAccessKeySecret string
}

// Storage 文件存储抽象。
//
// 关于 key：所有方法都以「对象键」为坐标，key 的目录前缀由**调用方**决定
// （用 ObjectKey 生成，如 ObjectKey("chat", ".jpg") → chat/2026/09/24/xxx.jpg）。
// 本包不知道也不关心业务目录结构 —— 这是它区别于 service/storage.go 的关键。
type Storage interface {
	// Put 上传一段字节，返回可访问的完整 URL。
	// contentType 会被如实写入；oss 驱动下必须正确，否则下游按类型判断的服务会拒收。
	Put(key string, data []byte, contentType string) (string, error)

	// PutDataURL 解析 data:<mime>;base64,<payload> 形式的字符串并上传。
	// key 由 prefix + 日期目录 + 随机串 + 按 MIME 推导的扩展名生成。
	// 传入的已经是 http(s) URL 时**原样返回**（幂等），方便前端复用历史消息。
	PutDataURL(prefix, raw string) (string, error)

	// Delete 删除对象。对象不存在时返回 nil（幂等）。
	Delete(key string) error

	// URL 由 key 拼出可访问 URL，不发任何请求。
	URL(key string) string

	// SignedURL 生成带签名的临时 URL，用于 bucket 私有的场景。
	// 公共读 bucket 上它没有意义（但也不会报错）。
	SignedURL(key string, ttl time.Duration) (string, error)
}

// New 按配置创建存储实现。
//
// 只校验「配置是否齐全、驱动名是否合法」：oss 驱动的 bucket 是否存在、凭据是否有效，
// 都要等真正上传才会暴露（oss.New 与 client.Bucket 都不发网络请求）。
// 刻意不做连通性预检 —— 若 RAM 子账号只授予 PutObject，任何读类探活都会 403 误报。
func New(cfg Config) (Storage, error) {
	switch cfg.Driver {
	case DriverOSS:
		return newOSS(cfg)
	case "", DriverLocal:
		return newLocal(cfg), nil
	default:
		// 不把 default 兜底成 local：驱动名写错时静默降级，
		// 会出现「配了 OSS 却仍写本地盘」这种极难察觉的现象。
		return nil, fmt.Errorf("未知的存储驱动 %q（可选：%s / %s）", cfg.Driver, DriverLocal, DriverOSS)
	}
}

// checkSize 校验单个对象是否超过配置上限
func checkSize(maxBytes int64, n int) error {
	if maxBytes > 0 && int64(n) > maxBytes {
		return fmt.Errorf("文件过大（%.1fMB），上限 %.1fMB",
			float64(n)/1024/1024, float64(maxBytes)/1024/1024)
	}
	return nil
}

// putFunc 与 Storage.Put 同签名，供 uploadDataURL 复用
type putFunc func(key string, data []byte, contentType string) (string, error)

// uploadDataURL 是两个驱动**完全共用**的 PutDataURL 实现：
// 幂等短路 → 解析 dataURL → 生成 key → 交给驱动自己的 Put。
func uploadDataURL(put putFunc, prefix, raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("文件数据为空")
	}
	// 已经是 URL —— 前端复用历史消息时会带上，原样返回保证幂等
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw, nil
	}
	if !strings.HasPrefix(raw, "data:") {
		return "", fmt.Errorf("不支持的格式：既不是 dataURL 也不是 http(s) URL")
	}

	data, contentType, err := decodeDataURL(raw)
	if err != nil {
		return "", err
	}
	return put(ObjectKey(prefix, extFromMime(contentType)), data, contentType)
}
