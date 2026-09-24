package storage

import (
	"encoding/base64"
	"fmt"
	stdmime "mime"
	"strings"
)

// decodeDataURL 解析 data:<mime>;base64,<payload> 形式的字符串。
//
// 返回 (字节, MIME, error)。**返回 MIME 而不是扩展名** —— oss 驱动要拿它当
// Content-Type，扩展名由调用方用 extFromMime 换算，两种驱动各取所需。
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
	if mime == "" {
		// 省略 MIME 的 dataURL 是合法的，兜底成 jpeg —— 与 extFromMime 的图片默认值一致，
		// 且绝不能留空：空 Content-Type 会让下游按类型判断的服务认不出这是图片。
		mime = "image/jpeg"
	}

	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		// 前端可能用了不带 padding 的编码，兜一下
		data, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return nil, "", fmt.Errorf("base64 解码失败: %w", err)
		}
	}
	return data, mime, nil
}

// extFromMime 把 MIME 映射成带点的文件扩展名。
//
// 图片类型走硬编码表：结果确定、不依赖运行环境的 MIME 数据库，
// 而扩展名会影响校色接口按 content-type 的判断，需要稳定。
// 其他类型交给标准库推导，推不出来用 .bin —— 旧版本对一切未知 MIME 都返回 .jpg，
// 那是图片专用时代的遗留，在通用文件存储下会误导。
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
		if exts, err := stdmime.ExtensionsByType(mime); err == nil && len(exts) > 0 {
			return exts[0]
		}
		return ".bin"
	}
}
