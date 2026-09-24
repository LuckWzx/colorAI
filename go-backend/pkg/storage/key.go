package storage

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"path"
	"time"
)

// ObjectKey 生成 prefix/YYYY/MM/DD/时间戳_随机串.ext 形式的对象键。
//
// ext 需带点（如 ".jpg"）。prefix 由调用方给（如 "chat"、"avatar"），
// 本包不预设任何业务目录。
//
// 设计动机：
//   - 按日期分目录 → 方便后期做保留策略（PRD 提到原图 7 天清理）
//   - 8 字节随机串 → 64 bit 熵，使 URL 不可枚举。公共读 bucket 下
//     这是**唯一的安全边界**（没有签名，知道 URL 就能访问）。
func ObjectKey(prefix, ext string) string {
	now := time.Now()
	dir := path.Join(prefix, now.Format("2006"), now.Format("01"), now.Format("02"))
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
