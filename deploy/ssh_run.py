#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲泉AI —— 在服务器上跑一段 shell 的通用工具。

用途：部署/排障时需要临时看点什么（内存、容器状态、文件），不必每次都写新脚本。
走的是 ssh_util.run_detached（落地脚本 + 后台跑 + 轮询哨兵），
所以即使命令在这台低内存服务器上卡住，也只是轮询到超时，不会把会话挂死。

用法：

    # 直接把命令写在参数里（简单命令）
    python deploy/ssh_run.py 'free -m; swapon --show; df -h /'

    # 从本地文件读一段脚本（复杂脚本，推荐）
    python deploy/ssh_run.py --file deploy/probe.sh

    # 超时放宽到 5 分钟
    python deploy/ssh_run.py --timeout 300 --file deploy/probe.sh

⚠️ 命令里的 `$` 会被本地 shell 抢先展开 —— 单引号包住整条命令即可
   （上面第一个例子就是这么写的）。用 --file 则完全不受影响。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ssh_util import add_ssh_args, connect, log, run_detached  # noqa: E402


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="在服务器上跑一段 shell（后台执行 + 轮询，不怕卡死）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("command", nargs="?", help="要执行的 shell 命令（注意本地 shell 会先展开 $）")
    ap.add_argument("--file", help="从本地文件读脚本体（复杂脚本推荐）")
    ap.add_argument("--timeout", type=int, default=180, help="最长等待秒数，默认 180")
    ap.add_argument("--sh", default="/root/_colorai_run.sh", help="远端脚本落地路径")
    ap.add_argument("--out", default="/root/_colorai_run.out", help="远端输出文件路径")
    ap.add_argument("--keep", action="store_true", help="跑完保留远端脚本与输出文件")
    add_ssh_args(ap)
    args = ap.parse_args()

    if args.file:
        body = Path(args.file).read_text(encoding="utf-8")
        log(f"脚本来源   {args.file}（{len(body.splitlines())} 行）")
    elif args.command:
        body = args.command
    else:
        ap.error("要么给一个命令，要么用 --file 指定脚本文件")

    log("=" * 64)
    log("远端执行")
    log("=" * 64)
    log(f"服务器   {args.user}@{args.host}:{args.port}")
    log(f"超时     {args.timeout}s")

    client = None
    try:
        client = connect(args)
        rc, out = run_detached(
            client, body, timeout=args.timeout, sh_path=args.sh, out_path=args.out
        )
        log("\n" + "-" * 64)
        log(out.rstrip())
        log("-" * 64)
        if rc == -1:
            log(f"⚠️ 超时（{args.timeout}s）—— 输出可能不完整。上面是已拿到的部分。")
        else:
            log(f"退出码 {rc}")

        if not args.keep:
            sftp = client.open_sftp()
            try:
                for p in (args.sh, args.out):
                    try:
                        sftp.remove(p)
                    except IOError:
                        pass
            finally:
                sftp.close()

        return 0 if rc == 0 else 1

    except Exception as exc:  # noqa: BLE001
        log(f"\n✗ 失败：{type(exc).__name__}: {exc}")
        return 1
    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    sys.exit(main())
