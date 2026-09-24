package storage

import (
	"net/http"
	"os"
	"testing"
	"time"
)

// 真实 OSS 往返测试 —— **默认跳过**，只有显式设了 OSS_LIVE_TEST=1 才跑：
//
//	cd go-backend && OSS_LIVE_TEST=1 \
//	  OSS_BUCKET=... OSS_ENDPOINT=... OSS_ACCESS_KEY_ID=... OSS_ACCESS_KEY_SECRET=... \
//	  OSS_PUBLIC_BASE_URL=... go test ./pkg/storage/ -run TestOSSLive -v
//
// 为什么默认跳过：它会**真的往 bucket 写一个对象**（用完即删），
// 不该让普通 `go test ./...` 对生产 bucket 产生副作用。
//
// 它验证的是端到端链路：凭据有效 → 能上传 → **匿名能读回**。
// 最后一条是关键：agent 的 image_correction 会用 httpx.get(image_url)
// 去下载图片，bucket 若不是公共读，这一步必然 403。
func TestOSSLive(t *testing.T) {
	if os.Getenv("OSS_LIVE_TEST") != "1" {
		t.Skip("未设置 OSS_LIVE_TEST=1，跳过真实 OSS 往返测试")
	}

	cfg := Config{
		Driver:             DriverOSS,
		OSSBucket:          os.Getenv("OSS_BUCKET"),
		OSSEndpoint:        os.Getenv("OSS_ENDPOINT"),
		OSSAccessKeyID:     os.Getenv("OSS_ACCESS_KEY_ID"),
		OSSAccessKeySecret: os.Getenv("OSS_ACCESS_KEY_SECRET"),
		PublicBaseURL:      os.Getenv("OSS_PUBLIC_BASE_URL"),
	}
	s, err := New(cfg)
	if err != nil {
		t.Fatalf("创建 OSS 驱动失败: %v", err)
	}

	// 放在 _probe/ 目录下，命名自解释，便于人工识别与清理
	key := ObjectKey("_probe", ".txt")
	body := []byte("colorai storage connectivity probe " + time.Now().Format(time.RFC3339))

	url, err := s.Put(key, body, "text/plain")
	if err != nil {
		t.Fatalf("上传失败（检查 AK/SK、bucket 名、endpoint region 是否一致）: %v", err)
	}
	t.Logf("✅ 上传成功: %s", url)

	// 无论后续断言成败都要清理，避免在 bucket 里留垃圾
	defer func() {
		if err := s.Delete(key); err != nil {
			t.Errorf("⚠️ 清理失败，请手动删除对象 %s: %v", key, err)
		} else {
			t.Logf("🧹 已清理探针对象 %s", key)
		}
	}()

	// 匿名 GET —— 这才是「读权限有没有放开」的判据。
	// 刻意用裸 http.Get（不带任何签名头），与 agent 侧 httpx.get 行为一致。
	resp, err := http.Get(url) //nolint:gosec // 探针 URL 由本测试自己生成
	if err != nil {
		t.Fatalf("匿名访问失败: %v", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		t.Log("✅ 匿名 GET 200 —— bucket 读权限已放开，agent 的校色工具能正常下载图片")
	case http.StatusForbidden:
		t.Error("❌ 匿名 GET 403 —— bucket 读权限**未**放开，agent 的 image_correction 会下载失败")
	default:
		t.Errorf("匿名 GET 返回意外状态码 %d", resp.StatusCode)
	}
}
