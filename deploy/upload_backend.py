#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲泉AI —— 后端部署文件上传脚本。

把「部署必需」的文件打包，上传到服务器并解包到目标目录。

    只传 docker-compose.yml + go-backend/ + deploy/     （约 19MB，压缩后 3~6MB）
    不传 ColorAI/（前端 dist 单独上传，见 deploy/部署清单.md §7）
    不传 agent/.venv（218MB，容器里重新 pip install）

用法（在本机 D:/GoLang/colorAI 目录下执行）：

    python deploy/upload_backend.py --dry-run     # 只列出要传什么，不连服务器
    python deploy/upload_backend.py               # 真上传
    python deploy/upload_backend.py --backup      # 远端已有内容时，先备份再覆盖

依赖：paramiko。用本机的隔离 venv 跑：

    C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe \\
        deploy/upload_backend.py --dry-run

密码来源（按优先级）：
    1) --password 参数
    2) 环境变量 COLORAI_SSH_PASS
    3) deploy/.sshpass 文件   ← 推荐，已在 .gitignore 里
    4) 交互式输入（不回显）

🔐 强烈建议改用密钥认证（--key ~/.ssh/id_ed25519）：一次性把公钥装到服务器后，
   这个脚本就再也不需要碰密码了。密码认证只是「先跑起来」的权宜之计。
"""

from __future__ import annotations

import argparse
import fnmatch
import os
import re
import shlex
import sys
import tarfile
import tempfile
import time
from pathlib import Path

# ---------------------------------------------------------------- 配置

# 本仓库根目录（本文件在 <root>/deploy/ 下）
LOCAL_ROOT = Path(__file__).resolve().parent.parent

# 默认远端目标目录
DEFAULT_REMOTE_DIR = "/home/www/project/colorAI"
DEFAULT_HOST = "118.31.10.161"
DEFAULT_USER = "root"
DEFAULT_PORT = 22

# 要上传的顶层条目（相对 LOCAL_ROOT）
MANIFEST = ["docker-compose.yml", "go-backend", "deploy"]

# 排除规则。匹配对象是「相对 LOCAL_ROOT 的 posix 路径」，
# 规则按「整路径 / 任一路径段 / 文件名」三种方式匹配（见 is_excluded）。
EXCLUDES = [
    # —— 体积大头，容器里会重新装 ——
    "go-backend/agent/.venv",
    # —— 本地专用，构建不需要 ——
    "go-backend/uploads",
    "go-backend/tool-test-output",
    "go-backend/testdata",
    "go-backend/agent/logs",
    "logs",
    "go-backend/agent/.idea",
    "go-backend/.idea",
    # —— 编译/运行产物 ——
    "**/__pycache__",
    "*.pyc",
    "*.pyo",
    "*.exe",
    "*.exe~",
    "*.test",
    "*.out",
    "colorai-backend",
    # —— 🔐 绝不能上传 ——
    ".sshpass",
    "upload_backend.py",
    # —— 版本控制 ——
    ".git",
]

# 传上去后要在远端保留的 tar 包名（解包完会删掉）
REMOTE_TARBALL = "/tmp/colorai-deploy.tar.gz"

# 远端已有内容时的备份目录后缀格式
BACKUP_SUFFIX_FMT = ".bak-%Y%m%d-%H%M%S"

# ---------------------------------------------------------------- 工具


def log(msg: str = "") -> None:
    print(msg, flush=True)


def human(n: int) -> str:
    """把字节数变成人能读的形式。"""
    f = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if f < 1024 or unit == "GB":
            return f"{f:.1f} {unit}" if unit != "B" else f"{int(f)} B"
        f /= 1024
    return f"{f:.1f} GB"


# Git Bash(MSYS) 会把**以 / 开头的命令行参数**改写成 Windows 绝对路径，例如
#   --remote-dir /root/nginx/blog   →   C:/Users/.../PortableGit/versions/x/root/nginx/blog
# 这是本机实测踩到的坑（2026-09-24）。不检测的话，后续校验会拿着一个
# 完全无关的路径报错，误导排查方向。
_MSYS_MANGLED = re.compile(r"^[A-Za-z]:[/\\]|/PortableGit/|/Git/mingw")


def check_msys_mangling(value: str, argname: str, default_ok: str | None = None) -> None:
    """检测并解释 MSYS 路径改写。命中就直接退出，给可执行的修法。"""
    if not value or not _MSYS_MANGLED.search(value):
        return

    hint = (
        f"    2) **直接省略 {argname}** —— 默认值 `{default_ok}` 就是对的"
        if default_ok
        else f"    2) 换一个不含 / 前缀的写法，或改用环境变量传入"
    )
    raise SystemExit(
        f"✗ 参数 {argname} 被 Git Bash 改写了（MSYS 路径转换）：\n"
        f"    你大概写的是：以 / 开头的路径\n"
        f"    程序实际收到：{value}\n"
        f"  修法（任选其一）：\n"
        f"    1) 命令前加 MSYS_NO_PATHCONV=1，例如：\n"
        f"       MSYS_NO_PATHCONV=1 <python> <脚本> {argname} <值>\n"
        f"{hint}\n"
        f"  ⚠️ 写成 `--arg=值` 也躲不过 —— 实测无效，别试。"
    )


def is_excluded(rel_posix: str, excludes: list[str]) -> bool:
    """rel_posix 是否命中排除规则。"""
    parts = rel_posix.split("/")
    for pat in excludes:
        # 整路径匹配，或作为目录前缀（排除整个子树）
        if fnmatch.fnmatch(rel_posix, pat) or rel_posix.startswith(pat + "/"):
            return True
        # 路径中任意一段命中（例：__pycache__、logs、.git）
        if any(fnmatch.fnmatch(p, pat) for p in parts):
            return True
    return False


def collect_files() -> list[tuple[Path, str]]:
    """遍历 MANIFEST，返回 [(本地绝对路径, 归档内的相对 posix 路径)]。

    目录会被展开成里面的文件；空目录也会保留（用空目录条目表示）。
    """
    picked: list[tuple[Path, str]] = []
    for entry in MANIFEST:
        p = LOCAL_ROOT / entry
        if not p.exists():
            raise FileNotFoundError(f"清单里的路径不存在：{p}")

        if p.is_file():
            if not is_excluded(entry, EXCLUDES):
                picked.append((p, entry))
            continue

        for dirpath, dirnames, filenames in os.walk(p):
            here = Path(dirpath)
            rel_dir = here.relative_to(LOCAL_ROOT).as_posix()

            # 就地剪枝：命中的目录直接不往下走（.venv 有上万个文件，剪枝很关键）
            dirnames[:] = sorted(
                d
                for d in dirnames
                if not is_excluded(f"{rel_dir}/{d}" if rel_dir != "." else d, EXCLUDES)
            )

            for fn in sorted(filenames):
                rel = f"{rel_dir}/{fn}" if rel_dir != "." else fn
                if not is_excluded(rel, EXCLUDES):
                    picked.append((here / fn, rel))

    return picked


def build_tarball(files: list[tuple[Path, str]], out: Path) -> int:
    """把文件打成 tar.gz。返回归档字节数。

    统一规范化权限：目录 0755、文件 0644。
    理由：Windows 上的 mode 没有意义，带过去可能出现 0777 这种意外权限。
    """
    total_raw = 0

    def _filter(ti: tarfile.TarInfo) -> tarfile.TarInfo:
        ti.uid = ti.gid = 0
        ti.uname = ti.gname = "root"
        ti.mode = 0o755 if ti.isdir() else 0o644
        return ti

    with tarfile.open(out, "w:gz", format=tarfile.PAX_FORMAT) as tf:
        for src, arcname in files:
            total_raw += src.stat().st_size
            tf.add(src, arcname=arcname, recursive=False, filter=_filter)

    return total_raw


# ---------------------------------------------------------------- SSH


def make_client(args):
    """建 SSH 连接（或复用密钥）。"""
    import paramiko  # 延迟导入：--dry-run 时不需要它

    client = paramiko.SSHClient()
    # ⚠️ 首次连接自动接受 host key —— 不做中间人校验。
    #    内网/自用服务器上可接受；要严格就自己维护 known_hosts。
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    kwargs = dict(
        hostname=args.host,
        port=args.port,
        username=args.user,
        timeout=20,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )

    if args.key:
        kwargs["key_filename"] = os.path.expanduser(args.key)
        kwargs["look_for_keys"] = True
    else:
        kwargs["password"] = resolve_password(args)

    log(f"→ 连接 {args.user}@{args.host}:{args.port} ...")
    client.connect(**kwargs)
    log("✓ 已连接")
    return client


def resolve_password(args) -> str:
    """按优先级取密码。"""
    if args.password:
        return args.password

    env = os.environ.get("COLORAI_SSH_PASS")
    if env:
        return env

    pwfile = LOCAL_ROOT / "deploy" / ".sshpass"
    if pwfile.exists():
        # 只取第一行，去掉尾随换行 —— 密码里可能有空格，所以不 strip 两边
        return pwfile.read_text(encoding="utf-8").splitlines()[0]

    import getpass

    return getpass.getpass(f"{args.user}@{args.host} 的密码：")


def run(client, cmd: str, timeout: int = 120, check: bool = True) -> tuple[int, str, str]:
    """在远端跑一条命令，返回 (退出码, stdout, stderr)。"""
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    rc = stdout.channel.recv_exit_status()
    if check and rc != 0:
        raise RuntimeError(f"远端命令失败（退出码 {rc}）：\n  $ {cmd}\n{err.strip()}")
    return rc, out, err


# ---------------------------------------------------------------- 步骤


def step_preflight(client, args) -> None:
    """连上后先摸清远端环境，避免传到一半才发现问题。"""
    log("\n── 远端环境 ─────────────────────────────")
    checks = [
        ("系统", "uname -a"),
        ("磁盘可用", f"df -h {shlex.quote(args.remote_dir.rsplit('/', 1)[0] or '/')} | tail -1"),
        ("docker", "docker --version 2>&1 || echo '(未安装)'"),
        ("docker-compose", "docker-compose --version 2>&1 || echo '(未安装)'"),
        ("目标目录", f"test -d {shlex.quote(args.remote_dir)} && echo '已存在' || echo '不存在（将创建）'"),
    ]
    for label, cmd in checks:
        _, out, _ = run(client, cmd, check=False)
        first = (out.strip().splitlines() or [""])[0]
        log(f"  {label:<16} {first}")


def step_backup(client, args) -> None:
    """目标目录非空 → 先整目录备份（文件系统级复制，不用 git）。"""
    q = shlex.quote(args.remote_dir)
    _, out, _ = run(
        client,
        f"test -d {q} && find {q} -mindepth 1 -maxdepth 1 | head -5 | wc -l || echo 0",
        check=False,
    )
    non_empty = out.strip().isdigit() and int(out.strip()) > 0
    if not non_empty:
        log("\n目标目录为空或不存在，无需备份")
        return

    stamp = time.strftime(BACKUP_SUFFIX_FMT)
    backup = args.remote_dir + stamp
    log(f"\n→ 目标目录已有内容，先备份到 {backup}")
    run(client, f"cp -r {q} {shlex.quote(backup)}", timeout=600)
    log("✓ 备份完成")


def step_upload(client, local_tar: Path) -> None:
    """SFTP 上传 tar 包，带百分比进度。"""
    size = local_tar.stat().st_size
    log(f"\n→ 上传 {local_tar.name}（{human(size)}）")

    state = {"last": -1}

    def progress(sent: int, total: int) -> None:
        pct = int(sent * 100 / total) if total else 100
        if pct != state["last"] and (pct % 10 == 0 or pct == 100):
            state["last"] = pct
            log(f"    {pct:3d}%  {human(sent)} / {human(total)}")

    sftp = client.open_sftp()
    try:
        sftp.put(str(local_tar), REMOTE_TARBALL, callback=progress, confirm=True)
    finally:
        sftp.close()
    log("✓ 上传完成")


def step_extract(client, args) -> None:
    """远端解包并清理。"""
    q_dir = shlex.quote(args.remote_dir)
    q_tar = shlex.quote(REMOTE_TARBALL)

    log(f"\n→ 解包到 {args.remote_dir}")
    run(client, f"mkdir -p {q_dir}")
    # LC_ALL=C.UTF-8：deploy/ 里有中文文件名，locale 不对 GNU tar 会报
    # "Ignoring unknown extended header keyword"（PAX 扩展头读不了）
    run(
        client,
        f"LC_ALL=C.UTF-8 LANG=C.UTF-8 tar -xzf {q_tar} -C {q_dir}",
        timeout=300,
    )
    run(client, f"rm -f {q_tar}", check=False)
    log("✓ 解包完成，远端临时包已删除")


def step_verify(client, args) -> None:
    """列出解包结果，并顺手校验 compose 能不能解析。"""
    q_dir = shlex.quote(args.remote_dir)

    log("\n── 远端目录结构 ─────────────────────────")
    _, out, _ = run(
        client,
        f"cd {q_dir} && ls -la && echo '---- 子目录 ----' && "
        f"find . -maxdepth 2 -type d -not -path '*/.git*' | sort | head -25",
        check=False,
    )
    log(out.rstrip())

    log("\n── 体积核对 ─────────────────────────────")
    _, out, _ = run(client, f"du -sh {q_dir}", check=False)
    log("  " + out.strip())

    log("\n── 两份 .env 是否到位（只查存在，不打印内容）──")
    for rel in ("go-backend/.env", "go-backend/agent/.env"):
        _, out, _ = run(
            client,
            f"test -f {q_dir}/{rel} && echo '✓ {rel}' || echo '✗ {rel}  ← 缺失！compose 会直接中止'",
            check=False,
        )
        log("  " + out.strip())

    log("\n── compose 解析（离线，不启容器）──────────")
    rc, out, err = run(
        client,
        f"cd {q_dir} && (docker-compose config --services 2>&1 || docker compose config --services 2>&1)",
        check=False,
    )
    if rc == 0:
        services = [s for s in out.strip().splitlines() if s.strip()]
        log("  服务列表：" + ", ".join(services))
        if set(services) == {"go-backend", "agent"}:
            log("  ✓ 正好两个服务，符合预期")
        else:
            log(f"  ⚠️ 预期正好 go-backend + agent 两个，实际 {len(services)} 个")
    else:
        log("  ⚠️ compose 解析失败（可能服务器上没装 docker-compose）：")
        log("    " + (err.strip() or out.strip())[:400])


# ---------------------------------------------------------------- 主流程


def main() -> int:
    # Windows 控制台默认 GBK，中文会炸
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="上传曲泉AI 后端部署文件",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--host", default=DEFAULT_HOST)
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--user", default=DEFAULT_USER)
    ap.add_argument("--remote-dir", default=DEFAULT_REMOTE_DIR)
    ap.add_argument("--password", help="不推荐：会进 shell 历史。优先用 deploy/.sshpass")
    ap.add_argument("--key", help="私钥路径，走密钥认证（推荐）")
    ap.add_argument("--backup", action="store_true", help="远端目录非空时先整目录备份")
    ap.add_argument("--dry-run", action="store_true", help="只列出要传什么，不连服务器")
    ap.add_argument("--keep-local-tar", action="store_true", help="保留本地临时 tar 包")
    args = ap.parse_args()

    # Git Bash 会把以 / 开头的参数改写掉 —— 先拦，否则后面报错会指向无关的地方
    check_msys_mangling(args.remote_dir, "--remote-dir", DEFAULT_REMOTE_DIR)
    check_msys_mangling(args.key or "", "--key")

    log("=" * 64)
    log("曲泉AI 后端上传")
    log("=" * 64)
    log(f"本地根目录  {LOCAL_ROOT}")
    log(f"远端目标    {args.user}@{args.host}:{args.remote_dir}")

    # ---- 1. 本地收集 ----
    log("\n→ 扫描要上传的文件 ...")
    files = collect_files()
    if not files:
        log("✗ 没扫到任何文件，检查 MANIFEST / EXCLUDES")
        return 1

    total_raw = sum(p.stat().st_size for p, _ in files)
    log(f"✓ {len(files)} 个文件，原始 {human(total_raw)}")

    # 按顶层分组统计，让「传了什么」一目了然
    buckets: dict[str, list[int]] = {}
    for p, rel in files:
        top = rel.split("/")[0]
        b = buckets.setdefault(top, [0, 0])
        b[0] += 1
        b[1] += p.stat().st_size
    log("\n  分组：")
    for top in sorted(buckets):
        n, sz = buckets[top]
        log(f"    {top:<20} {n:>5} 个  {human(sz)}")

    if args.dry_run:
        log("\n── 完整文件清单（--dry-run，未连服务器）──")
        for _, rel in sorted(files, key=lambda x: x[1]):
            log(f"  {rel}")
        log("\n被排除的重目录（确认一下有没有误伤）：")
        for e in ("go-backend/agent/.venv", "go-backend/uploads",
                  "go-backend/tool-test-output", "go-backend/testdata", "logs", "__pycache__"):
            log(f"    - {e}")
        log("\n✅ dry-run 结束，没连服务器、没写任何文件。")
        return 0

    # ---- 2. 打包 ----
    tmp_tar = Path(tempfile.gettempdir()) / "colorai-deploy.tar.gz"
    log(f"\n→ 打包到 {tmp_tar} ...")
    build_tarball(files, tmp_tar)
    packed = tmp_tar.stat().st_size
    log(f"✓ 打包完成 {human(packed)}（压缩率 {packed / total_raw * 100:.0f}%）")

    # ---- 3. 连接 + 上传 ----
    client = None
    try:
        client = make_client(args)
        step_preflight(client, args)

        if args.backup:
            step_backup(client, args)

        step_upload(client, tmp_tar)
        step_extract(client, args)
        step_verify(client, args)

    except Exception as exc:  # noqa: BLE001 —— 顶层兜底，要把原因原样打给用户
        log(f"\n✗ 失败：{type(exc).__name__}: {exc}")
        return 1
    finally:
        if client is not None:
            client.close()
        if not args.keep_local_tar and tmp_tar.exists():
            tmp_tar.unlink()
            log(f"\n（本地临时包已删除：{tmp_tar}）")

    log("\n" + "=" * 64)
    log("✅ 上传完成。接下来在服务器上：")
    log("=" * 64)
    log(f"  cd {args.remote_dir}")
    log("  vi go-backend/.env           # 按 deploy/部署清单.md §3 改 CORS_ORIGINS / DB_AUTO_MIGRATE")
    log("  vi go-backend/agent/.env     # 按 §3 改 PG_SSLMODE；🔴 不要加新键")
    log("  docker-compose up -d --build")
    log("  docker-compose ps")
    log("\n完整验收步骤见 deploy/部署清单.md §5~§9。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
