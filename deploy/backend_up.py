#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲泉AI —— 后端构建 + 启动（在服务器上跑 compose）。

════════════════════ 为什么单独一个脚本 ════════════════════
这台服务器（`118.31.10.161`，1.6GB 内存、无 swap）上 `docker build` / `docker run`
**会间歇性卡死**（本项目部署过程中已复现多次）。直接 `client.exec_command()` 的话
paramiko 的 `out.read()` 会一直阻塞到超时，期间拿不到任何中间输出。

所以走 `ssh_util.run_detached`：脚本体 SFTP 落到服务器 → `setsid nohup` 后台跑 →
客户端**轮询一个输出文件**。卡死时也只是「轮询到超时」，而不是「整个会话被挂住」。

════════════════════ 用法 ════════════════════
    <py> deploy/backend_up.py                 # 离线构建 + 启动（推荐，见下）
    <py> deploy/backend_up.py --online        # 在线构建（服务器上编译 + 联网 pip）
    <py> deploy/backend_up.py --no-build      # 只启动，不重建
    <py> deploy/backend_up.py --ps            # 只看状态
    <py> deploy/backend_up.py --logs          # 看日志（默认最后 60 行）
    <py> deploy/backend_up.py --down          # 停掉并删除两个容器

其中 `<py>` = `C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe`

════════════════════ 两种构建模式的区别 ════════════════════
**离线（默认）** —— 必须叠加 `docker-compose.offline.yml`：
    服务器只做 `COPY`（用本机交叉编译好的二进制 + 预下好的 wheel），
    内存峰值比在线低一个数量级，也不会在服务器上编译任何东西。
    前提：先跑过 `deploy/pack_offline.py`。
    ⚠️ 仍需联网拉基础镜像 `python:3.11-slim`（约 45MB）；`alpine:3.20` 本地已有。

**在线（--online）** —— 只用 `docker-compose.yml`：
    服务器上拉 `golang:1.25-alpine` + `go mod download` + 编译；
    agent 侧联网 `pip install` langchain 全家桶（峰值 0.5~1GB）→ **有 OOM 风险**。

⚠️ **离线模式必须叠加两个 `-f`** —— `docker-compose.offline.yml` 只覆盖 `build` 一节，
   单独用会丢掉 `env_file` / `networks` / `healthcheck` / `extra_hosts`。

密码来源沿用 `upload_backend`：`--password` → `$COLORAI_SSH_PASS` → `deploy/.sshpass` → 交互输入。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ssh_util import add_ssh_args, check_msys_mangling, connect, run_detached  # noqa: E402
from upload_backend import log  # noqa: E402

DEFAULT_REMOTE_DIR = "/home/www/project/colorAI"

# 离线模式：必须叠加，否则丢掉运行时配置
COMPOSE_OFFLINE = "docker-compose -f docker-compose.yml -f docker-compose.offline.yml"
# 在线模式：只用主文件
COMPOSE_ONLINE = "docker-compose -f docker-compose.yml"

SENTINEL_TAIL = "### REMOTE-RUN-END ###"


def compose_cmd(online: bool) -> str:
    return COMPOSE_ONLINE if online else COMPOSE_OFFLINE


def build_script(args) -> str:
    dc = compose_cmd(args.online)
    mode = "在线构建（服务器上编译）" if args.online else "离线构建（本机预编译，服务器只 COPY）"

    return f"""
cd {args.remote_dir} || exit 1

echo "########## 构建前 ##########"
free -m
df -h / | tail -1
echo
echo "模式：{mode}"
echo "命令：{dc} up -d --build"
echo
echo "########## 开始（这一步可能要几分钟，耐心等）##########"
{dc} up -d --build
RC=$?
echo
echo "### compose 退出码 = $RC"
echo
echo "########## 容器状态 ##########"
{dc} ps
echo
echo "########## 构建后内存 ##########"
free -m
echo
echo "########## colorai 镜像 ##########"
docker images --format '{{{{.Repository}}}}:{{{{.Tag}}}}  {{{{.Size}}}}' | grep -i colorai || echo "  (无)"
echo
echo "########## 容器内健康检查 ##########"
printf 'go-backend /api/health : '
docker exec colorai-go wget -qO- -T 5 http://127.0.0.1:3001/api/health 2>&1 | head -c 400
echo
printf 'agent     /health      : '
docker exec colorai-agent python -c "import urllib.request,sys; sys.stdout.write(urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=5).read().decode())" 2>&1 | head -c 400
echo
echo
echo "########## 宿主机侧探测（3001 只绑回环，就是给这步用的）##########"
printf 'curl 127.0.0.1:3001/api/health : '
(curl -s -m 5 http://127.0.0.1:3001/api/health 2>&1 || wget -qO- -T 5 http://127.0.0.1:3001/api/health 2>&1) | head -c 400
echo
echo
echo "########## 经 nginx(8080) 访问 ##########"
printf 'curl 127.0.0.1:8080/api/health : '
curl -s -m 5 http://127.0.0.1:8080/api/health 2>&1 | head -c 400
echo
exit $RC
""".strip()


def ps_script(args) -> str:
    dc = compose_cmd(args.online)
    return f"""
cd {args.remote_dir} || exit 1
echo "########## 容器状态 ##########"
{dc} ps
echo
echo "########## 全部 colorai 容器（含已退出）##########"
docker ps -a --filter name=colorai --format '{{{{.Names}}}}  {{{{.Status}}}}  {{{{.Image}}}}'
echo
echo "########## 内存 ##########"
free -m
""".strip()


def logs_script(args) -> str:
    dc = compose_cmd(args.online)
    return f"""
cd {args.remote_dir} || exit 1
echo "########## 最近 {args.tail} 行日志 ##########"
{dc} logs --tail={args.tail} 2>&1
""".strip()


def down_script(args) -> str:
    dc = compose_cmd(args.online)
    return f"""
cd {args.remote_dir} || exit 1
{dc} down
echo "### down 退出码 = $?"
echo
docker ps -a --filter name=colorai --format '{{{{.Names}}}}  {{{{.Status}}}}' || true
echo "（colorai-nginx 不在编排里，不受影响）"
""".strip()


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="曲泉AI 后端构建 + 启动",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    add_ssh_args(ap)
    ap.add_argument("--remote-dir", default=DEFAULT_REMOTE_DIR)
    ap.add_argument("--online", action="store_true",
                    help="在线构建（服务器上编译 + 联网 pip，有 OOM 风险）")
    ap.add_argument("--no-build", action="store_true", help="只启动，不重建（不加 --build）")
    ap.add_argument("--ps", action="store_true", help="只看容器状态")
    ap.add_argument("--logs", action="store_true", help="看日志")
    ap.add_argument("--tail", type=int, default=60, help="--logs 的行数（默认 60）")
    ap.add_argument("--down", action="store_true", help="停掉并删除两个容器")
    ap.add_argument("--timeout", type=int, default=1500, help="等待秒数（默认 1500）")
    args = ap.parse_args()

    check_msys_mangling(args.remote_dir, "--remote-dir", DEFAULT_REMOTE_DIR)

    if args.ps:
        body, label, timeout = ps_script(args), "查询容器状态", 180
    elif args.logs:
        body, label, timeout = logs_script(args), f"读取日志（{args.tail} 行）", 180
    elif args.down:
        body, label, timeout = down_script(args), "停止并删除容器", 300
    else:
        body, label, timeout = build_script(args), "构建 + 启动后端", args.timeout
        if args.no_build:
            body = body.replace(" up -d --build", " up -d")

    log("=" * 66)
    log(f"曲泉AI 后端 —— {label}")
    log("=" * 66)
    log(f"服务器    {args.user}@{args.host}:{args.port}")
    log(f"目录      {args.remote_dir}")
    if not (args.ps or args.logs or args.down):
        log(f"模式      {'在线构建' if args.online else '离线构建（推荐）'}")
    log("")

    client = connect(args)
    try:
        log("→ 已在服务器后台执行，下面轮询输出文件 ...\n")
        rc, out = run_detached(client, body, timeout=timeout)
        clean = out.replace(SENTINEL_TAIL, "").strip()
        print(clean)
        if rc != 0:
            log(f"\n⚠️ 远端脚本退出码 {rc}")
        return 0 if rc == 0 else 1
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
