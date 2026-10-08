#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲泉AI —— **离线构建**打包上传脚本（本机交叉编译 + 预下 wheel → 服务器只 COPY）。

════════════════════ 它解决什么问题 ════════════════════
生产服务器 `118.31.10.161` 只有 1.6GB 内存、**无 swap**（见 `deploy/部署清单.md` 文首）。
直接在服务器上跑 `docker-compose up -d --build` 要付出：

  * Go 侧：拉 `golang:1.25-alpine`(329MB) + `go mod download` + 编译
  * agent 侧：拉 `python:3.11-slim` + `apt-get install gcc` + 联网 `pip install` langchain 全家桶
    （峰值内存 0.5~1GB）

这些都是**完全可以在本机做掉**的。而 `CGO_ENABLED=0` 的 Go 产物是**静态二进制**，
本来就与构建机无关；Python 依赖全部有 manylinux 预编译 wheel，也不需要编译。
于是服务器侧只剩 `COPY` —— 内存开销可以忽略。

════════════════════ 它产出并上传什么 ════════════════════
    go-backend/colorai-backend-linux      ← 本机交叉编译的 linux/amd64 静态二进制（~13MB）
    go-backend/agent/wheels/*.whl         ← 本机预下载的 linux wheel 全集（~70 个 / 50MB）
    go-backend/Dockerfile.offline
    go-backend/agent/Dockerfile.offline
    docker-compose.offline.yml

**刻意只传这 5 类**，不碰 `docker-compose.yml` / `go-backend/agent/app/` 等基础文件 ——
那些仍由 `upload_backend.py` 负责。两个脚本职责不重叠，可以各自单独重跑。

════════════════════ 用法 ════════════════════
    # 0) 先把基础文件传上去（只需一次 / 或代码有改动时）
    <py> deploy/upload_backend.py

    # 1) 看清单，不联网、不编译
    <py> deploy/pack_offline.py --dry-run

    # 2) 全流程：下载 wheel → 交叉编译 → 打包 → 上传 → 远端校验
    <py> deploy/pack_offline.py --download-wheels

    # 3) 之后每次只改了业务代码，wheel 与二进制可复用：
    <py> deploy/pack_offline.py

    # 只本地打包、不连服务器（产物留在 --stage-dir 里，方便手工传）
    <py> deploy/pack_offline.py --skip-upload --keep-stage

其中 `<py>` = `C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe`

════════════════════ 服务器上怎么用 ════════════════════
    cd /home/www/project/colorAI
    docker-compose -f docker-compose.yml -f docker-compose.offline.yml up -d --build

⚠️ **必须叠加两个文件**。`docker-compose.offline.yml` 只覆盖 `build` 一节，
   单独用它会把 `env_file` / `networks` / `healthcheck` / `extra_hosts` 全丢掉。

════════════════════ 两个必须知道的坑 ════════════════════
1) 🔴 **`pip download` 在 Windows 上按「Windows 环境标记」求值依赖**
   → `sys_platform != "win32"` 的 Linux 专属依赖被**静默跳过**，不报任何错。
   实测漏掉的是 **`uvloop`**（`uvicorn[standard]` 的 extra，标记是
   `sys_platform != 'win32' and ... and extra == 'standard'`）。
   直到服务器上 `pip install --no-index` 才炸，排查成本很高。
   → 所以必须带 `--platform/--python-version/--only-binary=:all:`，
     且下载完**一定要跑本脚本内建的 Linux 标记校验**（`check_wheels`）。

2) 🔴 **tar 上传会把文件权限统一规范化成 0644**（见 `upload_backend.build_tarball`）
   → Go 二进制传上去是**不可执行**的，`CMD` 会以 `permission denied` 失败。
   Windows 上没有可执行位可指望 → 只能靠 `Dockerfile.offline` 里显式 `chmod +x`。
   本脚本会在远端校验里**断言这一行存在**。

3) ⚠️ **不要用 `pip install --dry-run --target ... --python-version 3.11` 当权威校验**。
   实测（2026-09-28）它**同样**按宿主 `sys_platform` 求值标记 —— 输出里
   `Would install ...` 那份清单**没有 uvloop**，与坑 1 是同一个盲点，
   只是换了个命令而已。它能证明的只有「名字/版本在本地目录里都找得到」，
   **不能**证明「Linux 上够用」。权威校验只有本脚本的 `check_wheels`（硬编码 Linux 标记）。

4) 🔴 **个别纯 Python 包在 PyPI 只发 sdist、不发 wheel**（实测 2026-10：`oss2`、`crcmod`）
   → `pip download --only-binary=:all:` 对它们直接报 "from versions: none"，**中止整个流程**。
   本脚本用 `pip wheel` 本机构建 any-wheel（py3-none-any，Linux 容器可直接安装）处理，
   见 `SDIST_ONLY_BUILD`；全量下载时这几行会先从临时 requirements 中滤掉。

密码来源沿用 `upload_backend`：`--password` → `$COLORAI_SSH_PASS` → `deploy/.sshpass` → 交互输入。
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

# 复用既有基建，别再造一套（sys.path 先插入 deploy/ 自身，保证能 import 同目录模块）
sys.path.insert(0, str(Path(__file__).resolve().parent))

from upload_backend import build_tarball, human, log  # noqa: E402
from ssh_util import add_ssh_args, check_msys_mangling, connect, run, run_detached  # noqa: E402

# ---------------------------------------------------------------- 配置

LOCAL_ROOT = Path(__file__).resolve().parent.parent
GO_DIR = LOCAL_ROOT / "go-backend"
AGENT_DIR = GO_DIR / "agent"
REQ_FILE = AGENT_DIR / "requirements.txt"

DEFAULT_REMOTE_DIR = "/home/www/project/colorAI"

# wheel 缓存目录。默认放 D:/tmp 而不是仓库内 —— 50MB 的二进制不该进 git 工作区。
DEFAULT_WHEELS_DIR = Path("D:/tmp/colorai-wheels")

# ⚠️ 必须用**默认 PyPI 源**。实测清华源在 `pip download` 下会报
#    `Could not find a version that satisfies the requirement ... (from versions: none)`。
DEFAULT_PIP_INDEX = "https://pypi.org/simple"

# ---------------------------------------------------------------- sdist-only 包
#
# 有些纯 Python 包在 PyPI **只发 sdist、不发 wheel**（实测 2026-10：oss2 2.19.1、crcmod 1.7）。
# `pip download --only-binary=:all:` 对它们直接报 "from versions: none" 并**中止整个流程**。
# 处理：用 `pip wheel` 在本地构建出 any-wheel（py3-none-any，Linux 容器可直接安装）放进
# wheels 目录，并在全量下载时把这几个包从 requirements 里滤掉
#（它们的依赖会被之后的「按 Linux 标记补漏」自动补齐）。
SDIST_ONLY_BUILD = ["oss2", "crcmod"]

# 目标平台：服务器是 Ubuntu 22.04 x86_64，镜像 `python:3.11-slim`（Debian bookworm）。
# 多列几个 manylinux 标签，兼容老包（如 httptools 只有 manylinux1）。
PLATFORM_ARGS = [
    "--platform", "manylinux_2_28_x86_64",
    "--platform", "manylinux_2_17_x86_64",
    "--platform", "manylinux2014_x86_64",
    "--platform", "manylinux1_x86_64",
    "--python-version", "3.11",
    "--only-binary=:all:",
]

# 远端临时包
REMOTE_TARBALL = "/tmp/colorai-offline.tar.gz"

# 本机默认输出的 linux 二进制名。
# ⚠️ 名字里的 `-linux` 后缀是**故意的**：`go-backend/.dockerignore` 里排除了
#    `colorai-backend`（本机 Windows 编译出的同名产物），带后缀正好避开那条规则。
GO_BINARY_NAME = "colorai-backend-linux"

# 要随包上传的静态文件：(仓库内相对路径, 归档内相对路径)
STATIC_FILES: list[tuple[str, str]] = [
    ("docker-compose.offline.yml", "docker-compose.offline.yml"),
    ("go-backend/Dockerfile.offline", "go-backend/Dockerfile.offline"),
    ("go-backend/agent/Dockerfile.offline", "go-backend/agent/Dockerfile.offline"),
]


# ---------------------------------------------------------------- wheel 完整性校验
#
# 这段逻辑是本脚本的**核心价值**：它按 **Linux 环境标记** 重新解析一遍依赖树。
# 直接读每个 wheel 内嵌的 METADATA（`Requires-Dist:` 行），不联网、不执行安装。
#
# 为什么不能信 `pip download` 的结果：见文件头「坑 1」。

# python:3.11-slim on x86_64 的标记环境
LINUX_MARKERS = {
    "implementation_name": "cpython",
    "implementation_version": "3.11.9",
    "os_name": "posix",
    "platform_machine": "x86_64",
    "platform_release": "6.1.0",
    "platform_system": "Linux",
    "platform_version": "#1 SMP",
    "python_full_version": "3.11.9",
    "platform_python_implementation": "CPython",
    "python_version": "3.11",
    "sys_platform": "linux",
}

# 对照用的 Windows 标记 —— 用来解释「目录里哪些包是 Windows 才需要、传上去是多余的」
WIN_MARKERS = dict(
    LINUX_MARKERS,
    os_name="nt",
    platform_system="Windows",
    sys_platform="win32",
    platform_machine="AMD64",
)


def _wheel_metadata(wheel: Path) -> str:
    with zipfile.ZipFile(wheel) as z:
        for n in z.namelist():
            if n.endswith(".dist-info/METADATA"):
                return z.read(n).decode("utf-8", "replace")
    return ""


def check_wheels(wheels_dir: Path, req_file: Path) -> tuple[list[str], list[str]]:
    """按 Linux 标记解析依赖树。返回 (缺失包名列表, 仅 Windows 需要的包名列表)。

    需要 `packaging`（本机隔离 venv 里已装）。
    """
    from packaging.requirements import Requirement
    from packaging.utils import canonicalize_name

    have: dict[str, Path] = {}
    for w in sorted(wheels_dir.glob("*.whl")):
        have[canonicalize_name(w.name.split("-")[0])] = w

    reqs: dict[str, list[Requirement]] = {}
    for name, w in have.items():
        out: list[Requirement] = []
        for line in _wheel_metadata(w).splitlines():
            if line.startswith("Requires-Dist:"):
                try:
                    out.append(Requirement(line.split(":", 1)[1].strip()))
                except Exception:
                    pass
        reqs[name] = out

    top: list[Requirement] = []
    for line in req_file.read_text(encoding="utf-8").splitlines():
        line = line.split("#")[0].strip()
        if line:
            top.append(Requirement(line))

    needed: dict[str, set[str]] = {}

    def add(name: str, extras: set[str]) -> bool:
        key = canonicalize_name(name)
        cur = needed.setdefault(key, set())
        if extras <= cur:
            return False
        cur |= extras
        return True

    for r in top:
        add(r.name, set(r.extras))

    def marker_ok(marker, extras: set[str], env_base: dict) -> bool:
        if marker is None:
            return True
        for e in (extras or {""}):
            env = dict(env_base)
            env["extra"] = e
            try:
                if marker.evaluate(env):
                    return True
            except Exception:
                # 求值不了就别拦，交给服务器实测（宁可多报也不要漏报）
                return True
        return False

    missing: list[tuple[str, Requirement]] = []
    changed = True
    while changed:
        changed = False
        for name, extras in list(needed.items()):
            for r in reqs.get(name, []):
                if not marker_ok(r.marker, extras, LINUX_MARKERS):
                    continue
                target = canonicalize_name(r.name)
                if target not in have:
                    missing.append((name, r))
                    continue
                if add(target, set(r.extras)):
                    changed = True

    missing_names = sorted({canonicalize_name(r.name) for _, r in missing})

    # 反查：目录里有、但 Linux 标记下用不到的（Windows 专属）
    win_only: set[str] = set()
    for name in have:
        if name in needed:
            continue
        for src, rs in reqs.items():
            for r in rs:
                if canonicalize_name(r.name) != name:
                    continue
                if not marker_ok(r.marker, needed.get(src, set()), LINUX_MARKERS) and marker_ok(
                    r.marker, needed.get(src, set()), WIN_MARKERS
                ):
                    win_only.add(name)

    return missing_names, sorted(win_only)


def step_check_wheels(wheels_dir: Path) -> list[str]:
    """跑校验并打印报告。返回缺失包名列表。"""
    log("\n── wheel 完整性校验（按 Linux 环境标记重解析依赖树）──")
    if not wheels_dir.is_dir():
        log(f"  ✗ 目录不存在：{wheels_dir}")
        return ["<目录不存在>"]

    n = len(list(wheels_dir.glob("*.whl")))
    size = sum(w.stat().st_size for w in wheels_dir.glob("*.whl"))
    log(f"  目录      {wheels_dir}")
    log(f"  内容      {n} 个 wheel，{human(size)}")

    missing, win_only = check_wheels(wheels_dir, REQ_FILE)

    if win_only:
        log(f"  ℹ️ 多余（Windows 才需要，Linux 上不会装）：{', '.join(win_only)}")
    if missing:
        log("  ❌ **Linux 上需要但目录里没有**：")
        for m in missing:
            log(f"       {m}")
        log("     → 用 --download-wheels 重下，本脚本会自动补这几个包。")
    else:
        log("  ✅ 依赖树完整，可以离线安装")
    return missing


# ---------------------------------------------------------------- 下载 wheel


def pip_base_cmd() -> list[str]:
    """本机隔离 venv 的 python（而不是当前进程的解释器）。

    脚本可能被任意 python 启动，但 wheel 下载必须用**装了 pip 的那个 venv**。
    """
    exe = Path(sys.executable)
    venv = Path("C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe")
    return [str(venv if venv.exists() else exe), "-m", "pip"]


def pip_download(args_list: list[str], desc: str) -> bool:
    cmd = pip_base_cmd() + ["download", *args_list]
    log(f"\n→ {desc}")
    log("  $ " + " ".join(cmd))
    rc = subprocess.call(cmd)
    if rc != 0:
        log(f"  ✗ pip download 失败（退出码 {rc}）")
        return False
    return True


def _filtered_requirements_file() -> Path:
    """生成一份去掉 sdist-only 包行的临时 requirements（写系统临时目录，不碰仓库文件）。

    全量 `pip download -r` 只要遇到一个找不到 wheel 的包就会中止，
    所以先把 SDIST_ONLY_BUILD 里的行滤掉；它们的 wheel 由 step_build_pure_wheels 提供。
    """
    skip = {n.lower().replace("_", "-") for n in SDIST_ONLY_BUILD}
    kept: list[str] = []
    for line in REQ_FILE.read_text(encoding="utf-8").splitlines():
        bare = line.split("#")[0].strip()
        name = re.split(r"[<>=!\[;\s]", bare, maxsplit=1)[0] if bare else ""
        if name.lower().replace("_", "-") in skip:
            continue
        kept.append(line)

    tmp = Path(tempfile.gettempdir()) / "colorai-requirements-offline.txt"
    tmp.write_text("\n".join(kept) + "\n", encoding="utf-8")
    return tmp


def step_build_pure_wheels(wheels_dir: Path) -> bool:
    """为 sdist-only 包本机构建 any-wheel（已存在则跳过）。见 SDIST_ONLY_BUILD 注释。"""
    todo = [
        n for n in SDIST_ONLY_BUILD
        if not list(wheels_dir.glob(f"{n.replace('-', '_')}-*.whl"))
    ]
    if not todo:
        log(f"\n→ sdist-only 包 wheel 已就绪：{', '.join(SDIST_ONLY_BUILD)}")
        return True

    cmd = pip_base_cmd() + [
        "wheel", *todo,
        "--no-deps",
        "-w", str(wheels_dir),
        "--index-url", DEFAULT_PIP_INDEX,
    ]
    log(f"\n→ 本机构建 sdist-only 包的 wheel：{', '.join(todo)}")
    log("  $ " + " ".join(cmd))
    if subprocess.call(cmd) != 0:
        log("  ✗ pip wheel 构建失败")
        return False

    ok = True
    for n in todo:
        found = list(wheels_dir.glob(f"{n.replace('-', '_')}-*.whl"))
        if not found:
            log(f"  ✗ {n}：构建后目录里仍没有 wheel")
            ok = False
        else:
            log(f"  ✓ {found[0].name}")
    return ok


def step_download_wheels(wheels_dir: Path) -> bool:
    """下载全套 wheel，并自动补齐 Windows 标记导致的漏包。"""
    wheels_dir.mkdir(parents=True, exist_ok=True)

    # sdist-only 包先本机构建，全量下载用过滤后的 requirements（否则 oss2 会让下载直接中止）
    if not step_build_pure_wheels(wheels_dir):
        return False
    ok = pip_download(
        [
            "-r", str(_filtered_requirements_file()),
            "-d", str(wheels_dir),
            *PLATFORM_ARGS,
            "--index-url", DEFAULT_PIP_INDEX,
        ],
        "下载 requirements.txt 的全部 linux wheel（已滤掉 sdist-only 包，见上）",
    )
    if not ok:
        return False

    # 🔴 关键补丁：Windows 上求值标记会漏掉 Linux 专属依赖（实测：uvloop）。
    #    这里按 Linux 标记查一遍，缺什么单独补下什么。最多补 5 轮 ——
    #    oss2 的依赖链较深（oss2 → aliyun-sdk-core → cryptography → cffi → pycparser，
    #    实测要 4 轮才收敛），轮数上限要留够。
    for attempt in range(1, 6):
        missing, _ = check_wheels(wheels_dir, REQ_FILE)
        if not missing:
            break
        log(f"\n⚠️ 第 {attempt} 轮补漏：{', '.join(missing)}")
        for pkg in missing:
            pip_download(
                [
                    pkg,
                    "-d", str(wheels_dir),
                    *PLATFORM_ARGS,
                    "--index-url", DEFAULT_PIP_INDEX,
                    "--no-deps",  # 只补这一个，避免它按 Windows 标记又拉一堆无关的
                ],
                f"补下 {pkg}",
            )
    return True


# ---------------------------------------------------------------- 交叉编译 Go


def is_linux_amd64_elf(p: Path) -> tuple[bool, str]:
    """校验产物确实是 linux/amd64 的 ELF 可执行文件。

    比「命令退出码为 0」强得多 —— 万一 GOOS 没生效，这里能当场拦住，
    不至于把一个 Windows PE 传到服务器上才发现。
    """
    head = p.read_bytes()[:64]
    if len(head) < 20:
        return False, "文件太小，不是有效二进制"
    if head[:4] != b"\x7fELF":
        magic = head[:2]
        kind = "PE/Windows" if magic == b"MZ" else repr(magic)
        return False, f"不是 ELF（识别为 {kind}）—— GOOS/GOARCH 没生效？"
    ei_class = head[4]  # 1=32bit, 2=64bit
    e_machine = struct.unpack_from("<H", head, 18)[0]  # 62 = EM_X86_64
    if ei_class != 2 or e_machine != 62:
        return False, f"不是 x86-64（class={ei_class}, machine={e_machine}）"
    return True, "linux/amd64 ELF"


def step_build_go(out_path: Path, go_exe: str) -> bool:
    log("\n→ 交叉编译 Go 后端（CGO_ENABLED=0 / GOOS=linux / GOARCH=amd64）")
    env = dict(os.environ, CGO_ENABLED="0", GOOS="linux", GOARCH="amd64")
    cmd = [
        go_exe, "build",
        "-trimpath",
        "-ldflags=-s -w",
        "-o", str(out_path),
        ".",
    ]
    log("  $ " + " ".join(cmd))
    try:
        rc = subprocess.call(cmd, cwd=str(GO_DIR), env=env)
    except FileNotFoundError:
        log(f"  ✗ 找不到 go 可执行文件：{go_exe}（用 --go 指定绝对路径）")
        return False
    if rc != 0:
        log(f"  ✗ go build 失败（退出码 {rc}）")
        return False
    if not out_path.exists():
        log("  ✗ 命令成功但没有产物")
        return False

    ok, why = is_linux_amd64_elf(out_path)
    size = human(out_path.stat().st_size)
    if ok:
        log(f"  ✓ {out_path.name}  {size}  [{why}]")
    else:
        log(f"  ✗ 产物校验失败：{why}")
        return False
    return True


# ---------------------------------------------------------------- 打包 / 上传


def collect_artifacts(stage: Path, wheels_dir: Path) -> list[tuple[Path, str]]:
    """返回 [(本地文件, 归档内相对路径)]，供 build_tarball 使用。"""
    files: list[tuple[Path, str]] = []

    # 1) 静态文件（compose 覆盖层 + 两份离线 Dockerfile）
    for rel_src, arc in STATIC_FILES:
        src = LOCAL_ROOT / rel_src
        if not src.exists():
            raise FileNotFoundError(f"缺少文件：{src}")
        files.append((src, arc))

    # 2) 交叉编译产物
    binary = stage / GO_BINARY_NAME
    if not binary.exists():
        raise FileNotFoundError(f"缺少交叉编译产物：{binary}")
    files.append((binary, f"go-backend/{GO_BINARY_NAME}"))

    # 3) wheel 全集
    wheels = sorted(wheels_dir.glob("*.whl"))
    if not wheels:
        raise FileNotFoundError(f"{wheels_dir} 里没有 wheel")
    for w in wheels:
        files.append((w, f"go-backend/agent/wheels/{w.name}"))

    return files


def step_upload(client, args, tar_path: Path) -> None:
    """SFTP 上传 tar（带进度），远端解包。"""
    size = tar_path.stat().st_size
    log(f"\n→ 上传 {tar_path.name}（{human(size)}）")

    state = {"last": -1}

    def progress(sent: int, total: int) -> None:
        pct = int(sent * 100 / total) if total else 100
        if pct != state["last"] and (pct % 10 == 0 or pct == 100):
            state["last"] = pct
            log(f"    {pct:3d}%  {human(sent)} / {human(total)}")

    sftp = client.open_sftp()
    try:
        sftp.put(str(tar_path), REMOTE_TARBALL, callback=progress, confirm=True)
    finally:
        sftp.close()
    log("  ✓ 上传完成")

    q_dir = f"'{args.remote_dir}'"
    log(f"\n→ 解包到 {args.remote_dir}")
    run(client, f"mkdir -p {q_dir}")
    # LC_ALL：PAX 扩展头里有非 ASCII 时 GNU tar 会报 unknown extended header keyword
    run(client, f"LC_ALL=C.UTF-8 LANG=C.UTF-8 tar -xzf {REMOTE_TARBALL} -C {q_dir}", timeout=300)
    run(client, f"rm -f {REMOTE_TARBALL}", check=False)
    log("  ✓ 解包完成，远端临时包已删除")


VERIFY_SCRIPT = r"""
cd {q_dir} || exit 1

echo "--- 1) 离线构建所需的 5 类产物 ---"
for f in docker-compose.offline.yml go-backend/Dockerfile.offline \
         go-backend/agent/Dockerfile.offline go-backend/colorai-backend-linux; do
  if [ -f "$f" ]; then printf '  ✓ %-42s %s\n' "$f" "$(du -h "$f" | cut -f1)"
  else printf '  ✗ %-42s **缺失**\n' "$f"; fi
done
echo "  ✓ go-backend/agent/wheels/                $(ls go-backend/agent/wheels/*.whl 2>/dev/null | wc -l) 个 / $(du -sh go-backend/agent/wheels 2>/dev/null | cut -f1)"

echo
echo "--- 2) 二进制类型（必须是 ELF 64-bit x86-64）---"
head -c 20 go-backend/colorai-backend-linux | od -An -tx1 | head -2

echo
echo "--- 3) 🔴 Dockerfile.offline 里必须有 chmod +x ---"
if grep -q 'chmod +x /app/colorai-backend' go-backend/Dockerfile.offline; then
  echo "  ✓ 有（tar 上传会把权限归一成 0644，没这行容器起不来）"
else
  echo "  ✗ **没有！** 容器会以 permission denied 失败"
fi

echo
echo "--- 4) 基础文件是否已由 upload_backend.py 传好 ---"
for f in docker-compose.yml go-backend/Dockerfile go-backend/agent/Dockerfile \
         go-backend/agent/requirements.txt go-backend/agent/app/main.py \
         go-backend/.env go-backend/agent/.env; do
  if [ -e "$f" ]; then echo "  ✓ $f"; else echo "  ✗ $f   ← 缺失（先跑 upload_backend.py）"; fi
done

echo
echo "--- 5) compose 叠加解析（只取服务名，不展开密钥）---"
if command -v docker-compose >/dev/null 2>&1; then DC=docker-compose; else DC="docker compose"; fi
echo "  使用：$DC"
$DC -f docker-compose.yml -f docker-compose.offline.yml config --services 2>&1 | sed 's/^/    /'

echo
echo "--- 6) 磁盘余量 ---"
df -h / | tail -1
""".strip()


def step_verify(client, args) -> None:
    log("\n── 远端校验 ─────────────────────────────")
    rc, out = run_detached(client, VERIFY_SCRIPT.format(q_dir=args.remote_dir), timeout=180)
    log(out.replace("### REMOTE-RUN-END ###", "").strip() or "(无输出)")
    if rc != 0:
        log(f"  ⚠️ 校验脚本退出码 {rc}（部分检查项可能没跑到）")


# ---------------------------------------------------------------- 主流程


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="曲泉AI 离线构建打包上传（本机交叉编译 + 预下 wheel）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    add_ssh_args(ap)
    ap.add_argument("--remote-dir", default=DEFAULT_REMOTE_DIR)
    ap.add_argument("--wheels-dir", default=str(DEFAULT_WHEELS_DIR),
                    help=f"wheel 缓存目录（默认 {DEFAULT_WHEELS_DIR}）")
    ap.add_argument("--go", default="go", help="go 可执行文件（默认从 PATH 找）")
    ap.add_argument("--download-wheels", action="store_true",
                    help="重新联网下载 wheel（用默认 PyPI 源，会自动补 Linux 专属漏包）")
    ap.add_argument("--skip-build", action="store_true", help="跳过 go build，复用已有二进制")
    ap.add_argument("--skip-upload", action="store_true", help="只本地打包，不连服务器")
    ap.add_argument("--check-wheels", action="store_true", help="只做 wheel 完整性校验，然后退出")
    ap.add_argument("--stage-dir", default=None, help="本地暂存目录（默认用系统临时目录）")
    ap.add_argument("--keep-stage", action="store_true", help="保留暂存目录与 tar 包")
    ap.add_argument("--dry-run", action="store_true", help="只列清单，不编译、不下载、不联网")
    args = ap.parse_args()

    # Git Bash 会把以 / 开头的参数改写成 Windows 路径 —— 先拦
    check_msys_mangling(args.remote_dir, "--remote-dir", DEFAULT_REMOTE_DIR)

    wheels_dir = Path(args.wheels_dir)

    log("=" * 66)
    log("曲泉AI 离线构建打包")
    log("=" * 66)
    log(f"仓库根目录  {LOCAL_ROOT}")
    log(f"wheel 目录  {wheels_dir}")
    if not args.skip_upload:
        log(f"远端目标    {args.user}@{args.host}:{args.remote_dir}")

    # ---- 只校验 wheel ----
    if args.check_wheels:
        missing = step_check_wheels(wheels_dir)
        return 1 if missing else 0

    # ---- dry-run：把要发生的事说清楚 ----
    if args.dry_run:
        log("\n【dry-run】不会编译、不会下载、不会联网。\n")
        log("── 将执行 ──────────────────────────────")
        log(f"  1. 交叉编译  cd {GO_DIR}")
        log(f"     CGO_ENABLED=0 GOOS=linux GOARCH=amd64 {args.go} build -trimpath \\")
        log(f"       -ldflags=\"-s -w\" -o <stage>/{GO_BINARY_NAME} .")
        log(f"  2. wheel     {wheels_dir}"
            + ("（--download-wheels 会重下）" if args.download_wheels else "（复用现有）"))
        log("  3. 校验      Linux 标记重解析依赖树，确认无漏包")
        log("  4. 打包      tar.gz（权限归一成 0644）")
        if not args.skip_upload:
            log(f"  5. 上传      SFTP → {REMOTE_TARBALL} → 解包到 {args.remote_dir}")
            log("  6. 校验      远端产物 / ELF 类型 / chmod +x / compose 叠加解析")
        log("\n── 将上传的 5 类产物 ────────────────────")
        for rel_src, arc in STATIC_FILES:
            src = LOCAL_ROOT / rel_src
            mark = "✓" if src.exists() else "✗ 缺失"
            log(f"  {mark}  {arc}")
        n = len(list(wheels_dir.glob("*.whl"))) if wheels_dir.is_dir() else 0
        log(f"  {'✓' if n else '✗'}  go-backend/agent/wheels/  ({n} 个 wheel)")
        log(f"  ?  go-backend/{GO_BINARY_NAME}  （编译后才存在）")
        log("\n── 这些**不会**被动到（仍归 upload_backend.py）──")
        for f in ("docker-compose.yml", "go-backend/Dockerfile", "go-backend/agent/Dockerfile",
                  "go-backend/agent/app/", "go-backend/.env", "go-backend/agent/.env"):
            log(f"    - {f}")
        log("\n✅ dry-run 结束。")
        return 0

    # ---- 准备暂存目录 ----
    if args.stage_dir:
        stage = Path(args.stage_dir)
        stage.mkdir(parents=True, exist_ok=True)
        cleanup_stage = False
    else:
        stage = Path(tempfile.mkdtemp(prefix="colorai-offline-"))
        cleanup_stage = True

    tmp_tar = Path(tempfile.gettempdir()) / "colorai-offline.tar.gz"
    client = None
    rc_final = 0

    try:
        # ---- 1. wheel ----
        if args.download_wheels:
            if not step_download_wheels(wheels_dir):
                return 1
        missing = step_check_wheels(wheels_dir)
        if missing:
            log("\n✗ wheel 集合不完整，先解决上面的漏包（可加 --download-wheels）。")
            return 1

        # ---- 2. 交叉编译 ----
        binary = stage / GO_BINARY_NAME
        if args.skip_build and binary.exists():
            ok, why = is_linux_amd64_elf(binary)
            log(f"\n→ 跳过编译，复用 {binary}（{human(binary.stat().st_size)}，{why}）")
            if not ok:
                log("  ✗ 复用的产物不是 linux/amd64 ELF —— 去掉 --skip-build 重编")
                return 1
        else:
            if not step_build_go(binary, args.go):
                return 1

        # ---- 3. 打包 ----
        files = collect_artifacts(stage, wheels_dir)
        total_raw = sum(p.stat().st_size for p, _ in files)
        log(f"\n→ 打包 {len(files)} 个文件（原始 {human(total_raw)}）")
        build_tarball(files, tmp_tar)
        packed = tmp_tar.stat().st_size
        log(f"  ✓ {tmp_tar}  {human(packed)}（压缩率 {packed / total_raw * 100:.0f}%）")

        log("\n  分组：")
        buckets: dict[str, list[int]] = {}
        for p, arc in files:
            top = "/".join(arc.split("/")[:3]) if arc.startswith("go-backend/agent/wheels") else arc
            b = buckets.setdefault(top, [0, 0])
            b[0] += 1
            b[1] += p.stat().st_size
        for top in sorted(buckets):
            n, sz = buckets[top]
            log(f"    {top:<44} {n:>3} 个  {human(sz)}")

        if args.skip_upload:
            log(f"\n(--skip-upload) 产物已就绪：{tmp_tar}")
            if args.keep_stage:
                log(f"(--keep-stage) 暂存目录：{stage}")
            rc_final = 0
        else:
            # ---- 4. 上传 + 校验 ----
            client = connect(args)
            step_upload(client, args, tmp_tar)
            step_verify(client, args)

    except Exception as exc:  # noqa: BLE001 —— 顶层兜底，原因要原样打给用户
        log(f"\n✗ 失败：{type(exc).__name__}: {exc}")
        rc_final = 1
    finally:
        if client is not None:
            client.close()
        keep = args.keep_stage or args.stage_dir or args.skip_upload
        if not keep:
            if cleanup_stage and stage.exists():
                shutil.rmtree(stage, ignore_errors=True)
            if tmp_tar.exists():
                tmp_tar.unlink()
                log(f"\n（本地临时文件已清理：{tmp_tar}）")

    if rc_final != 0:
        return rc_final

    log("\n" + "=" * 66)
    log("✅ 打包上传完成。接下来在服务器上执行：")
    log("=" * 66)
    log(f"  cd {args.remote_dir}")
    log("  # 先确认两份 .env 已按 deploy/部署清单.md §3 改好（CORS_ORIGINS / DB_AUTO_MIGRATE / PG_SSLMODE）")
    log("  docker-compose -f docker-compose.yml -f docker-compose.offline.yml up -d --build")
    log("  docker-compose -f docker-compose.yml -f docker-compose.offline.yml ps")
    log("  docker-compose -f docker-compose.yml -f docker-compose.offline.yml logs -f agent")
    log("")
    log("⚠️ 必须叠加两个 -f。offline.yml 只覆盖 build 一节，")
    log("   单独用会丢掉 env_file / networks / healthcheck / extra_hosts。")
    log("")
    log("⚠️ 构建前建议先加 2GB swap（服务器无 swap，见部署清单文首）——")
    log("   虽然离线构建已经几乎不占内存，但 python:3.11-slim 基础镜像仍要拉 ~45MB。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
