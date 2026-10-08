"""OSS 转存：把外部临时文件（抠图结果等）下载并存入自有 OSS。

背景：搭档的抠图服务返回的结果 URL 是**临时内网地址** —— 会过期、外网浏览器
也访问不到。抠图工具在拿到结果后立刻调用本模块转存，让 LLM 写进回复、
Go 落库的 URL 永久有效（与 go-backend 同一套 OSS 配置，见 .env 的 OSS 区块）。

与 go-backend/pkg/storage 的约定对齐（2026-10-08，两侧必须一致）：
  - key 规则：ObjectKey → prefix/YYYY/MM/DD/YYYYMMDD_HHMMSS_<16hex><ext>
  - URL 规则：OSS_PUBLIC_BASE_URL + "/" + key（oss 驱动语义，**无** /uploads 前缀）
  - 扩展名：图片走硬编码表（对齐 Go 的 extFromMime），其余交给标准库
  - 幂等：URL 已属于本 bucket（公共域名前缀）时原样返回
⚠️ 目录日期取各自本地时区（与 Go 不强制同一时区——只影响归档目录，不影响唯一性）。
"""

import mimetypes
import secrets
from datetime import datetime

import httpx
import oss2
from loguru import logger

from app.config import settings

# 图片 MIME → 扩展名。硬编码而非查 MIME 数据库：结果确定、不依赖运行环境，
# 且与 go-backend/pkg/storage/dataurl.go 的 extFromMime 逐项对齐（改了要同步两侧）。
_IMAGE_EXTS = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/heic": ".heic",
    "image/heif": ".heic",
}

# oss2.Bucket 懒加载单例（初始化一次即可，别每次转存都重建）
_bucket: "oss2.Bucket | None" = None


def _ensure_configured() -> None:
    """OSS 启用但配置缺失时给出明确错误（而不是到 SDK 里报晦涩的签名错）"""
    missing = [
        k for k in (
            "OSS_BUCKET", "OSS_ENDPOINT", "OSS_ACCESS_KEY_ID",
            "OSS_ACCESS_KEY_SECRET", "OSS_PUBLIC_BASE_URL",
        )
        if not getattr(settings, k)
    ]
    if missing:
        raise RuntimeError(f"OSS 配置缺失：{', '.join(missing)}（见 agent/.env 的 OSS 区块）")


def _get_bucket() -> "oss2.Bucket":
    """懒加载 oss2 Bucket 实例"""
    global _bucket
    if _bucket is None:
        auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
        _bucket = oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET)
    return _bucket


def _object_key(prefix: str, ext: str) -> str:
    """与 go-backend/pkg/storage/key.go 的 ObjectKey 同构：
    prefix/YYYY/MM/DD/YYYYMMDD_HHMMSS_<16hex(8字节)><ext>

    随机串（16 个 hex 字符）不可枚举 —— bucket 是公共读，这是唯一的安全边界。
    """
    now = datetime.now()
    return f"{prefix}/{now:%Y/%m/%d}/{now:%Y%m%d_%H%M%S}_{secrets.token_hex(8)}{ext}"


def _ext_from_mime(mime: str) -> str:
    """MIME → 带点扩展名。图片走硬编码表；其余用标准库推导；推不出兜 .bin"""
    m = (mime or "").strip().lower()
    if not m:
        return ".bin"
    if m in _IMAGE_EXTS:
        return _IMAGE_EXTS[m]
    return mimetypes.guess_extension(m) or ".bin"


def import_url(prefix: str, url: str) -> str:
    """下载外部 http(s) URL 并转存到 OSS，返回持久 URL。

    :param prefix: 对象键目录前缀（与 Go 的目录约定一致，聊天资产用 "chat"）
    :param url: 外部临时文件的 URL
    :return: OSS 持久 URL
    :raises: 配置缺失 / 下载失败 / 超限 / 上传失败时抛异常（调用方决定降级策略）
    """
    _ensure_configured()

    url = url.strip()
    if not url:
        raise ValueError("待转存的 URL 为空")
    if not url.startswith(("http://", "https://")):
        raise ValueError(f"只支持 http(s) URL，收到：{url[:80]}")

    base = settings.OSS_PUBLIC_BASE_URL.rstrip("/")
    if url.startswith(base + "/"):
        return url  # 已在本 bucket（幂等：防重入 / 重复调用）

    # 1) 流式下载 —— 边读边查上限，不把超大文件整个读进内存才拒绝
    limit = settings.OSS_MAX_BYTES
    chunks: list[bytes] = []
    total = 0
    with httpx.stream("GET", url, timeout=settings.OSS_TIMEOUT, follow_redirects=True) as resp:
        resp.raise_for_status()
        content_type = (resp.headers.get("content-type") or "").split(";")[0].strip()
        for chunk in resp.iter_bytes():
            total += len(chunk)
            if limit > 0 and total > limit:
                raise ValueError(f"文件超过上限 {limit} 字节，拒绝转存：{url[:80]}")
            chunks.append(chunk)
    if total == 0:
        raise ValueError("下载内容为空")

    # 2) 上传 —— Content-Type 如实写入（空 Content-Type 会让下游按类型判断的服务拒收）
    data = b"".join(chunks)
    key = _object_key(prefix, _ext_from_mime(content_type))
    ct = content_type or "application/octet-stream"
    _get_bucket().put_object(key, data, headers={"Content-Type": ct})

    persistent = f"{base}/{key}"
    logger.info(f"[oss_store] 转存完成：{key}（{total} 字节，{ct}）→ {persistent}")
    return persistent
