#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲泉AI —— 前端 dist 上传脚本（方案 A：dist 放进 nginx 的 blog 挂载目录）。

为什么不直接 `rsync --delete`：
  1. **本机没有 rsync**（实测缺失，只有 PortableGit 的 scp，且只能交互式输密码）。
  2. `--delete` 目标写错一级就是灾难 ——
       rsync -av --delete dist/ root@host:/root/nginx/blog/     ← 漏了 /colorai
     会把 blog 自己的 front/ 和 admin/ **全删掉**。
  本脚本用 SFTP，并把「目标必须是 /root/nginx/blog/<站点名>」写死成硬校验，
  从根上让那个错误不可能发生。

用法（在本机 D:/GoLang/colorAI 下执行）：

    PY="C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe"

    "$PY" deploy/upload_dist.py --dry-run          # 只看要传什么
    "$PY" deploy/upload_dist.py --clean            # 清空远端目标目录再传（等价 --delete）
    "$PY" deploy/upload_dist.py                    # 增量覆盖，不删多余文件

前置：先在本地 `cd ColorAI && npm run build` 产出 dist/。
"""

from __future__ import annotations

import argparse
import os
import shlex
import sys
import time
from pathlib import Path

# 复用 upload_backend.py 里的 SSH/SFTP 基础设施，避免复制一份连接逻辑
sys.path.insert(0, str(Path(__file__).resolve().parent))
from upload_backend import (  # noqa: E402
    DEFAULT_HOST,
    DEFAULT_PORT,
    DEFAULT_USER,
    LOCAL_ROOT,
    check_msys_mangling,
    human,
    log,
    make_client,
    run,
)

# 本地 dist 目录
LOCAL_DIST = LOCAL_ROOT / "ColorAI" / "dist"

# 远端目标（方案 A）
DEFAULT_REMOTE_DIR = "/root/nginx/blog/colorai"

# 🔒 硬校验：目标必须正好是这个父目录下的一级子目录
#    —— 这一条就是防「漏写 /colorai」的。改成方案 B（/var/www/...）时同步改这里。
SAFE_PARENT = "/root/nginx/blog"

# 🔒 这些是 blog 自己的目录，绝不允许当目标
FORBIDDEN_LEAVES = {"front", "admin", "blog"}


def assert_safe_target(remote_dir: str, force: bool) -> None:
    """把「目标路径写错」这件事变成启动即失败。"""
    p = remote_dir.rstrip("/")

    if not p:
        raise SystemExit("✗ 目标路径为空")

    parent, _, leaf = p.rpartition("/")
    if not leaf:
        raise SystemExit(f"✗ 目标路径不能以 / 结尾：{remote_dir}")

    if force:
        log(f"⚠️  --force 已指定，跳过安全检查（目标 {p}）")
        return

    if parent != SAFE_PARENT:
        raise SystemExit(
            f"✗ 拒绝执行：目标必须是 `{SAFE_PARENT}/<站点名>` 形式\n"
            f"    当前：{p}\n"
            f"    父目录：{parent or '(空)'}\n"
            f"  —— 这条校验是为了防止 `--delete` 式的误删（把 {SAFE_PARENT} 下\n"
            f"     别人的目录一起清掉）。确实要传别处就加 --force。"
        )

    if leaf in FORBIDDEN_LEAVES:
        raise SystemExit(
            f"✗ 拒绝执行：`{leaf}` 是 blog 自己的目录，不是我们的站点目录。\n"
            f"    站点目录应该长这样：{SAFE_PARENT}/colorai"
        )


def collect_files(root: Path) -> list[tuple[Path, str]]:
    """遍历本地目录，返回 [(绝对路径, 相对 posix 路径)]。"""
    out: list[tuple[Path, str]] = []
    for dirpath, dirnames, filenames in os.walk(root):
        here = Path(dirpath)
        rel_dir = here.relative_to(root).as_posix()
        for fn in sorted(filenames):
            rel = fn if rel_dir == "." else f"{rel_dir}/{fn}"
            out.append((here / fn, rel))
    return out


def ensure_remote_dir(sftp, path: str) -> None:
    """逐级创建远端目录（SFTP 的 mkdir 不会自动建父目录）。"""
    cur = ""
    for part in path.strip("/").split("/"):
        cur += "/" + part
        try:
            sftp.stat(cur)
        except IOError:
            sftp.mkdir(cur)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="上传前端 dist 到 nginx 的 blog 挂载目录（方案 A）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--host", default=DEFAULT_HOST)
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--user", default=DEFAULT_USER)
    ap.add_argument("--remote-dir", default=DEFAULT_REMOTE_DIR)
    ap.add_argument("--password", help="不推荐。优先用 deploy/.sshpass")
    ap.add_argument("--key", help="私钥路径，走密钥认证（推荐）")
    ap.add_argument("--clean", action="store_true",
                    help="先清空远端目标目录（等价 rsync --delete）。不清则只增量覆盖")
    ap.add_argument("--force", action="store_true", help="跳过目标路径安全检查（危险）")
    ap.add_argument("--dry-run", action="store_true", help="只列出要传什么，不连服务器")
    args = ap.parse_args()

    log("=" * 64)
    log("曲泉AI 前端 dist 上传（方案 A）")
    log("=" * 64)
    log(f"本地来源    {LOCAL_DIST}")
    log(f"远端目标    {args.user}@{args.host}:{args.remote_dir}")

    # ---- 0. 参数与目标路径安全检查（连服务器之前就拦住）----
    # Git Bash 会把以 / 开头的参数改写掉 —— 先拦，否则后面报错会指向无关的地方
    check_msys_mangling(args.remote_dir, "--remote-dir", DEFAULT_REMOTE_DIR)
    check_msys_mangling(args.key or "", "--key")
    assert_safe_target(args.remote_dir, args.force)

    # ---- 1. 本地 dist ----
    if not LOCAL_DIST.is_dir():
        log(f"\n✗ 本地没有 {LOCAL_DIST}")
        log("  先在本地构建：cd ColorAI && npm run build")
        return 1

    if not (LOCAL_DIST / "index.html").is_file():
        log(f"\n✗ {LOCAL_DIST} 里没有 index.html —— 这不像一个完整的 dist 产物")
        return 1

    files = collect_files(LOCAL_DIST)
    total = sum(p.stat().st_size for p, _ in files)
    newest = max((p.stat().st_mtime for p, _ in files), default=0)

    log(f"\n→ 本地 dist：{len(files)} 个文件，{human(total)}")
    log(f"   构建时间：{time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(newest))}")

    if args.dry_run:
        log("\n── 文件清单（--dry-run，未连服务器）──")
        for _, rel in sorted(files, key=lambda x: x[1]):
            log(f"  {rel}")
        log(f"\n✅ dry-run 结束。真跑加 --clean（清空远端再传）或直接跑（增量覆盖）。")
        return 0

    # ---- 2. 连接 ----
    client = None
    try:
        client = make_client(args)
        q = shlex.quote(args.remote_dir)

        # ---- 3. 可选：清空远端目标（等价 --delete，但路径已被校验过）----
        if args.clean:
            log(f"\n→ --clean：清空 {args.remote_dir}")
            run(client, f"rm -rf {q}")
            log("✓ 已清空")
        else:
            _, before, _ = run(
                client,
                f"test -d {q} && find {q} -type f | wc -l || echo 0",
                check=False,
            )
            log(f"\n→ 增量模式：远端当前有 {before.strip()} 个文件（不会删除多余文件）")

        # ---- 4. 建目录 ----
        run(client, f"mkdir -p {q}")
        ensure_remote_dir(client.open_sftp(), args.remote_dir)

        # ---- 5. 上传 ----
        log(f"\n→ 上传 {len(files)} 个文件 ...")
        sftp = client.open_sftp()
        try:
            dirs_done = {args.remote_dir}
            for i, (src, rel) in enumerate(sorted(files, key=lambda x: x[1]), 1):
                remote = f"{args.remote_dir}/{rel}"
                rdir = remote.rsplit("/", 1)[0]
                if rdir not in dirs_done:
                    ensure_remote_dir(sftp, rdir)
                    dirs_done.add(rdir)

                sftp.put(str(src), remote)
                # Windows 的 mode 没有意义，显式给 nginx 可读的权限
                sftp.chmod(remote, 0o644)

                if i % 5 == 0 or i == len(files):
                    log(f"    {i}/{len(files)}")
        finally:
            sftp.close()
        log("✓ 上传完成")

        # ---- 6. 校验 ----
        log("\n── 远端核对 ─────────────────────────────")
        _, out, _ = run(client, f"find {q} -type f | wc -l", check=False)
        remote_n = out.strip()
        log(f"  远端文件数    {remote_n}   （本地 {len(files)}）"
            + ("   ✓ 一致" if remote_n == str(len(files)) else "   ⚠️ 不一致"))

        _, out, _ = run(client, f"du -sh {q}", check=False)
        log(f"  远端体积      {out.strip()}")

        _, out, _ = run(client, f"ls -la {q} | head -12", check=False)
        log("  目录内容：")
        for ln in out.strip().splitlines():
            log("    " + ln)

        # 关键文件必须存在，否则 nginx 会 403/404
        for must in ("index.html", "assets"):
            _, out, _ = run(
                client,
                f"test -e {q}/{must} && echo OK || echo MISSING",
                check=False,
            )
            log(f"  {must:<12} {'✓' if out.strip() == 'OK' else '✗ 缺失'}")

    except Exception as exc:  # noqa: BLE001
        log(f"\n✗ 失败：{type(exc).__name__}: {exc}")
        return 1
    finally:
        if client is not None:
            client.close()

    log("\n" + "=" * 64)
    log("✅ dist 已就位。接下来在服务器上：")
    log("=" * 64)
    log(f"  cp /home/www/project/colorAI/deploy/nginx/colorai.conf /root/nginx/conf.d/colorai.conf")
    log(f"  vi /root/nginx/conf.d/colorai.conf      # 改 server_name 成你的域名")
    log(f"  docker network connect colorai-net nginx-container   # 热加网络，不用重建容器")
    log(f"  docker exec nginx-container nginx -t && docker exec nginx-container nginx -s reload")
    log("\n（方案 A 不需要重建 nginx 容器。详见 deploy/部署清单.md §8）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
