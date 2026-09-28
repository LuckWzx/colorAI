#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲泉AI —— 远端执行公共模块。

从 upload_backend.py 里抽出来的 SSH 基建，给部署脚本共用：

    read_remote / put_remote      单文件读写
    run_detached                  落地脚本 + setsid nohup 后台跑 + 轮询哨兵
    add_ssh_args / connect        统一的命令行参数与连接

════════════════════ 为什么需要 run_detached ════════════════════
这台服务器（118.31.10.161，1.6GB 内存、无 swap）上 `docker run` / `docker build`
会**间歇性卡死**（本次部署中已复现 3 次）。直接 `client.exec_command()` 的话：

  * paramiko 的 `out.read()` 会一直阻塞到 timeout，期间拿不到任何中间输出；
  * 服务器侧套 `timeout 40` 也没用 —— 它杀不掉已经卡住的 docker CLI 进程。

所以改成：把脚本体用 SFTP 落成一个 .sh → `setsid nohup ... &` 后台起 →
**轮询一个输出文件**，看到哨兵行就收工。这样完全不受 SSH 长连接是否还活着影响，
卡死时也只是「轮询到超时」，而不是「整个会话被挂住」。

脚本体用 `( ... )` 子 shell 包住：里面任何 `exit N` 只退出子 shell，
哨兵行**一定**会打出来（否则一旦 exit，哨兵不出现，只能干等超时）。
"""

from __future__ import annotations

import argparse
import shlex
import time
from pathlib import Path

from upload_backend import (  # noqa: F401 —— 这里集中转出，调用方不用再各导一遍
    DEFAULT_HOST,
    DEFAULT_PORT,
    DEFAULT_USER,
    LOCAL_ROOT,
    check_msys_mangling,
    human,
    log,
    make_client,
    resolve_password,
    run,
)

SENTINEL = "### REMOTE-RUN-END ###"

DEFAULT_SH = "/root/_colorai_run.sh"
DEFAULT_OUT = "/root/_colorai_run.out"


# ---------------------------------------------------------------- 文件读写


def read_remote(client, path: str) -> str:
    sftp = client.open_sftp()
    try:
        with sftp.open(path, "r") as f:
            return f.read().decode("utf-8", "replace")
    finally:
        sftp.close()


def put_remote(client, local: str | Path, remote: str, mode: int = 0o644) -> None:
    sftp = client.open_sftp()
    try:
        sftp.put(str(local), remote, confirm=True)
        sftp.chmod(remote, mode)
    finally:
        sftp.close()


def put_text(client, text: str, remote: str, mode: int = 0o644) -> None:
    sftp = client.open_sftp()
    try:
        with sftp.open(remote, "w") as f:
            f.write(text)
        sftp.chmod(remote, mode)
    finally:
        sftp.close()


# ---------------------------------------------------------------- 后台执行


def run_detached(
    client,
    script_body: str,
    timeout: int = 240,
    sh_path: str = DEFAULT_SH,
    out_path: str = DEFAULT_OUT,
    quiet: bool = False,
) -> tuple[int, str]:
    """把脚本体落到服务器上后台跑，轮询哨兵文件，返回 (退出码, 完整输出)。"""
    body = (
        "#!/bin/bash\n"
        "set -uo pipefail\n"
        'echo "[start $(date +%F_%H:%M:%S)]"\n'
        "(\n"
        f"{script_body}\n"
        ")\n"
        "RC=$?\n"
        f'echo "{SENTINEL} rc=$RC"\n'
    )

    sftp = client.open_sftp()
    try:
        with sftp.open(sh_path, "w") as f:
            f.write(body)
        sftp.chmod(sh_path, 0o755)
        try:
            sftp.remove(out_path)  # 清掉旧输出，免得轮询到上一次的哨兵
        except IOError:
            pass
    finally:
        sftp.close()

    # 后台启动：< /dev/null 断开 stdin，setsid 脱离控制终端
    run(
        client,
        f"setsid nohup bash {shlex.quote(sh_path)} > {shlex.quote(out_path)} 2>&1 < /dev/null & echo started",
        timeout=30,
        check=False,
    )

    deadline = time.time() + timeout
    text = ""
    seen = 0
    while time.time() < deadline:
        time.sleep(2)
        try:
            text = read_remote(client, out_path)
        except IOError:
            continue
        if SENTINEL in text:
            tail = text.split(SENTINEL, 1)[1].strip()
            try:
                rc = int(tail.split("rc=", 1)[1].split()[0])
            except Exception:
                rc = -1
            return rc, text
        # 静默模式下，输出每增长一截就提示一次，避免看起来像卡住
        if not quiet and len(text) > seen + 400:
            seen = len(text)
            last = [ln for ln in text.strip().splitlines() if ln.strip()][-1:]
            if last:
                log(f"    … {last[0][:100]}")

    return -1, text


# ---------------------------------------------------------------- 参数与连接


def add_ssh_args(ap: argparse.ArgumentParser) -> None:
    """给调用方的 ArgumentParser 挂上统一的连接参数。"""
    ap.add_argument("--host", default=DEFAULT_HOST)
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--user", default=DEFAULT_USER)
    ap.add_argument("--password", help="不推荐：会进 shell 历史。优先用 deploy/.sshpass")
    ap.add_argument("--key", help="私钥路径")


def connect(args):
    """连上服务器（沿用 upload_backend.make_client 的密码优先级）。"""
    check_msys_mangling(args.key or "", "--key")
    return make_client(args)
