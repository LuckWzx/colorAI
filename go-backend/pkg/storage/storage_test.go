package storage

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// 驱动选择与配置校验。这个测试**完全离线**：
// local 与 oss 的构造都不发网络请求（oss.New 只做 endpoint 规范化，
// client.Bucket 只创建句柄），所以不需要任何云凭据。
func TestNew_DriverSelection(t *testing.T) {
	t.Run("local 驱动应创建成功", func(t *testing.T) {
		s, err := New(Config{
			Driver:        DriverLocal,
			LocalDir:      "uploads",
			PublicBaseURL: "http://localhost:3001",
		})
		if err != nil {
			t.Fatalf("local 驱动不应报错，实际: %v", err)
		}
		if s == nil {
			t.Fatal("local 驱动应返回实例")
		}
	})

	t.Run("驱动留空按 local 兜底", func(t *testing.T) {
		if _, err := New(Config{PublicBaseURL: "http://localhost:3001"}); err != nil {
			t.Fatalf("空驱动名应兜底为 local，实际报错: %v", err)
		}
	})

	t.Run("未知驱动必须报错而不是静默降级", func(t *testing.T) {
		_, err := New(Config{Driver: "osss"})
		if err == nil {
			t.Fatal("未知驱动名应报错 —— 静默降级成本地存储会出现「配了 OSS 却仍写本地盘」")
		}
		if !strings.Contains(err.Error(), "osss") {
			t.Errorf("错误信息应带上写错的驱动名，实际: %v", err)
		}
	})

	t.Run("oss 驱动缺 bucket/endpoint 应报错", func(t *testing.T) {
		if _, err := New(Config{Driver: DriverOSS}); err == nil {
			t.Fatal("oss 驱动缺少 bucket / endpoint 时应报错")
		}
	})

	t.Run("oss 驱动缺凭据应报错", func(t *testing.T) {
		_, err := New(Config{
			Driver:        DriverOSS,
			OSSBucket:     "demo-bucket",
			OSSEndpoint:   "oss-cn-beijing.aliyuncs.com",
			PublicBaseURL: "https://demo-bucket.oss-cn-beijing.aliyuncs.com",
		})
		if err == nil {
			t.Fatal("oss 驱动缺少 access key 时应报错")
		}
	})
}

// local 驱动的真实读写往返 —— 用临时目录，不碰项目里的 uploads/
func TestLocal_PutDataURL_And_Delete(t *testing.T) {
	dir := t.TempDir()
	s, err := New(Config{
		Driver:        DriverLocal,
		LocalDir:      dir,
		PublicBaseURL: "http://localhost:3001",
	})
	if err != nil {
		t.Fatalf("创建 local 驱动失败: %v", err)
	}

	url, err := s.PutDataURL("chat", "data:image/png;base64,iVBORw0KGgo=")
	if err != nil {
		t.Fatalf("PutDataURL 失败: %v", err)
	}
	if !strings.HasPrefix(url, "http://localhost:3001/uploads/chat/") {
		t.Errorf("URL 前缀不符（应为 PublicBaseURL + /uploads/ + prefix/），实际: %s", url)
	}
	if !strings.HasSuffix(url, ".png") {
		t.Errorf("扩展名应按 MIME 推导为 .png，实际: %s", url)
	}

	key := strings.TrimPrefix(url, "http://localhost:3001/uploads/")
	if _, err := os.Stat(filepath.Join(dir, filepath.FromSlash(key))); err != nil {
		t.Errorf("文件未落盘: %v", err)
	}

	t.Run("已是 URL 时原样返回（幂等）", func(t *testing.T) {
		same, err := s.PutDataURL("chat", url)
		if err != nil {
			t.Fatalf("幂等分支不应报错: %v", err)
		}
		if same != url {
			t.Errorf("应原样返回，得到 %q", same)
		}
	})

	t.Run("Delete 幂等", func(t *testing.T) {
		if err := s.Delete(key); err != nil {
			t.Fatalf("首次删除失败: %v", err)
		}
		if _, err := os.Stat(filepath.Join(dir, filepath.FromSlash(key))); !os.IsNotExist(err) {
			t.Error("删除后文件仍存在")
		}
		if err := s.Delete(key); err != nil {
			t.Errorf("重复删除应幂等，实际: %v", err)
		}
	})
}

// 公共包的调用方不受本包控制，key 必须挡住路径穿越
func TestLocal_RejectsPathTraversal(t *testing.T) {
	s, err := New(Config{Driver: DriverLocal, LocalDir: t.TempDir(), PublicBaseURL: "http://x"})
	if err != nil {
		t.Fatalf("创建 local 驱动失败: %v", err)
	}

	bad := []string{"../evil.jpg", "a/../../evil.jpg", "/etc/passwd", `a\b.jpg`, ""}
	for _, key := range bad {
		if _, err := s.Put(key, []byte("x"), "image/jpeg"); err == nil {
			t.Errorf("Put 应拒绝非法 key %q", key)
		}
		if err := s.Delete(key); err == nil {
			t.Errorf("Delete 应拒绝非法 key %q", key)
		}
	}
}

// local 没有签名机制，必须显式报错而不是返回空串
func TestLocal_SignedURLUnsupported(t *testing.T) {
	s, _ := New(Config{Driver: DriverLocal, LocalDir: t.TempDir(), PublicBaseURL: "http://x"})
	if _, err := s.SignedURL("chat/a.jpg", time.Hour); err == nil {
		t.Fatal("local 驱动不支持签名 URL，应报错")
	}
}

// 超过上限必须拒绝，且要在落盘/上传之前
func TestPut_RejectsOversize(t *testing.T) {
	s, _ := New(Config{
		Driver:         DriverLocal,
		LocalDir:       t.TempDir(),
		PublicBaseURL:  "http://x",
		MaxUploadBytes: 4,
	})
	if _, err := s.Put("chat/big.jpg", []byte("12345"), "image/jpeg"); err == nil {
		t.Fatal("超过 MaxUploadBytes 应被拒绝")
	}
	if _, err := s.Put("chat/ok.jpg", []byte("1234"), "image/jpeg"); err != nil {
		t.Errorf("刚好等于上限应通过，实际: %v", err)
	}
}

// ObjectKey 的格式与不可枚举性
func TestObjectKey(t *testing.T) {
	k := ObjectKey("chat", ".jpg")
	if !strings.HasPrefix(k, "chat/") {
		t.Errorf("应以 prefix 开头，实际 %q", k)
	}
	if !strings.HasSuffix(k, ".jpg") {
		t.Errorf("应以扩展名结尾，实际 %q", k)
	}
	// 公共读 bucket 没有签名，URL 不可枚举是唯一的安全边界
	if k == ObjectKey("chat", ".jpg") {
		t.Error("两次生成的 key 不应相同 —— 随机串失效会让 URL 可枚举")
	}
}

func TestDecodeDataURL(t *testing.T) {
	t.Run("正常 dataURL 返回声明的 MIME", func(t *testing.T) {
		data, mime, err := decodeDataURL("data:image/png;base64,iVBORw0KGgo=")
		if err != nil {
			t.Fatalf("解析失败: %v", err)
		}
		if mime != "image/png" {
			t.Errorf("MIME 应为 image/png，实际 %q", mime)
		}
		if len(data) == 0 {
			t.Error("应解出非空字节")
		}
	})

	t.Run("省略 MIME 时兜底为 image/jpeg 而不是空串", func(t *testing.T) {
		_, mime, err := decodeDataURL("data:;base64,iVBORw0KGgo=")
		if err != nil {
			t.Fatalf("解析失败: %v", err)
		}
		// 空 Content-Type 会让下游按类型判断的服务认不出这是图片，必须兜底
		if mime != "image/jpeg" {
			t.Errorf("空 MIME 应兜底为 image/jpeg，实际 %q", mime)
		}
	})

	t.Run("非 base64 应报错", func(t *testing.T) {
		if _, _, err := decodeDataURL("data:image/png,plaintext"); err == nil {
			t.Fatal("非 base64 编码应报错")
		}
	})

	t.Run("缺逗号应报错", func(t *testing.T) {
		if _, _, err := decodeDataURL("data:image/png;base64"); err == nil {
			t.Fatal("缺逗号分隔符应报错")
		}
	})
}

func TestExtFromMime(t *testing.T) {
	// 图片类型走硬编码表，结果必须确定
	cases := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/webp": ".webp",
		"image/heic": ".heic",
	}
	for mime, want := range cases {
		if got := extFromMime(mime); got != want {
			t.Errorf("extFromMime(%q) = %q，期望 %q", mime, got, want)
		}
	}

	// 未知类型不应再返回 .jpg —— 那是图片专用时代的遗留，通用存储下会误导
	if got := extFromMime("application/x-totally-unknown"); got == ".jpg" {
		t.Error("未知 MIME 不应返回 .jpg")
	}
}
