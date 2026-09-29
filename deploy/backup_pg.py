#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲泉AI —— 备份远程 PostgreSQL 知识库（schema colorai_kb）。

为什么走服务器容器而不是本地（2026-09-29 实测）：
    本机（Windows）没装 PostgreSQL 客户端（pg_dump / psql 都没有，
    Docker Desktop 也没在运行），而服务器上的 WeKnora-postgres 容器
    自带与库版本完全一致的 pg_dump —— 直接 docker exec 用它最省事，
    既不依赖本机环境，也不用拉镜像。

流程：
    SSH → 探测 postgres 容器 → docker exec pg_dump 导出到远端临时文件
    → SFTP 下载到 go-backend/data/ → 本地校验（表数 / 数据段 / 结束标记）
    → 清理远端临时文件

用法：
    python deploy/backup_pg.py                  # 备份到 go-backend/data/colorai_kb_<日期>.sql
    python deploy/backup_pg.py --dry-run        # 只探测：容器、pg_dump 版本、三表行数
    python deploy/backup_pg.py --out D:\\bak\\kb.sql

恢复提示（dump 不含扩展本身，先建扩展再灌）：
    docker exec -i WeKnora-postgres psql -U postgres -d docmind -c "CREATE EXTENSION IF NOT EXISTS vector;"
    docker exec -i WeKnora-postgres psql -U postgres -d docmind < colorai_kb_<日期>.sql
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ssh_util import add_ssh_args, connect, human, log, run_detached  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
REMOTE_SQL = "/root/_colorai_pg_backup.sql"
REMOTE_ERR = "/root/_colorai_pg_backup.err"
# 服务器上的 agent/.env（部署时随上传带上，里面就有 PG_PASSWORD）
SERVER_ENV = "/home/www/project/colorAI/go-backend/agent/.env"

# 前置探测：找容器 + 取口令（不把任何密码写进本脚本）
# ⚠️ 这段只能用 replace 拼，不能走 str.format()：
#    format 会把 {{.Names}} 折叠成 {.Names}，docker --format 直接失效（踩过）。
FIND_CONTAINER = (
    "C=$(docker ps --format '{{.Names}}' | grep -i postgres | head -n1 || true)\n"
    'if [ -z "$C" ]; then echo "ERROR: 服务器上没找到 postgres 容器"; exit 1; fi\n'
    'PW=$(grep "^PG_PASSWORD=" __ENV__ 2>/dev/null | head -n1 | cut -d= -f2- || true)\n'
)


def read_env(path: Path) -> dict[str, str]:
    """只读 .env 里的 KEY=VALUE（本脚本仅取 PG_DB / PG_SCHEMA 两个非敏感项）。"""
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    return env


def build_probe(db: str, schema: str) -> str:
    return FIND_CONTAINER.replace("__ENV__", SERVER_ENV) + f'''
echo "容器: $C"
docker exec "$C" pg_dump --version
echo "--- 三表行数（看数据规模）---"
for T in kb_builds kb_chunks kb_colors; do
  N=$(docker exec -e PGPASSWORD="$PW" "$C" psql -U postgres -d {db} -Atc "SELECT count(*) FROM {schema}.$T" 2>&1 || true)
  echo "  {schema}.$T = $N"
done
'''


def build_export(db: str, schema: str) -> str:
    return FIND_CONTAINER.replace("__ENV__", SERVER_ENV) + f'''
echo "容器: $C"
docker exec "$C" pg_dump --version
if [ -n "$PW" ]; then echo "口令来源: 服务器 .env"; else echo "口令: 空（依赖容器 local trust）"; fi

rm -f {REMOTE_SQL} {REMOTE_ERR}
docker exec -e PGPASSWORD="$PW" "$C" pg_dump -U postgres -d {db} -n {schema} \\
    --no-owner --no-privileges --no-tablespaces --clean --if-exists --encoding=UTF8 \\
    > {REMOTE_SQL} 2>{REMOTE_ERR}
RC=$?
echo "pg_dump_rc=$RC"
if [ "$RC" -ne 0 ]; then echo "--- pg_dump stderr（截尾 20 行）---"; tail -n 20 {REMOTE_ERR}; fi
echo "bytes=$(wc -c < {REMOTE_SQL} || echo 0)"
echo "create_table=$(grep -c '^CREATE TABLE' {REMOTE_SQL} || true)"
echo "data_blocks=$(grep -cE '^(COPY |INSERT INTO )' {REMOTE_SQL} || true)"
echo "--- 文件末尾 ---"
tail -n 3 {REMOTE_SQL} || true
[ "$RC" -eq 0 ]
'''


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="备份远程 PostgreSQL 知识库（走服务器容器内的 pg_dump）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--dry-run", action="store_true", help="只探测容器/版本/行数，不导出")
    ap.add_argument("--out", help="本地输出文件（默认 go-backend/data/colorai_kb_<日期>.sql）")
    ap.add_argument("--db", help="数据库名（默认读 go-backend/agent/.env 的 PG_DB）")
    ap.add_argument("--schema", help="schema 名（默认读 go-backend/agent/.env 的 PG_SCHEMA）")
    add_ssh_args(ap)
    args = ap.parse_args()

    env = read_env(REPO_ROOT / "go-backend" / "agent" / ".env")
    db = args.db or env.get("PG_DB", "docmind")
    schema = args.schema or env.get("PG_SCHEMA", "colorai_kb")

    if args.out:
        out_path = Path(args.out)
    else:
        out_path = REPO_ROOT / "go-backend" / "data" / f"colorai_kb_{date.today():%Y%m%d}.sql"

    log("=" * 64)
    log(f"PostgreSQL 知识库备份（库: {db}，schema: {schema}）")
    log("=" * 64)
    log(f"服务器   {args.user}@{args.host}:{args.port}")
    log(f"输出     {out_path}")

    client = None
    try:
        client = connect(args)

        if args.dry_run:
            rc, out = run_detached(client, build_probe(db, schema), timeout=120)
            log("\n" + out.rstrip())
            return 0 if rc == 0 else 1

        rc, out = run_detached(client, build_export(db, schema), timeout=600)
        log("-" * 64)
        log(out.rstrip())
        log("-" * 64)
        if rc != 0:
            log("✗ 远端导出失败，未下载。")
            return 1

        out_path.parent.mkdir(parents=True, exist_ok=True)
        sftp = client.open_sftp()
        try:
            size = sftp.stat(REMOTE_SQL).st_size
            log(f"远端文件 {human(size)}，开始下载 …")
            sftp.get(REMOTE_SQL, str(out_path))
        finally:
            sftp.close()

        # 本地校验：能过这三关，文件基本可放心用于恢复
        data = out_path.read_bytes()
        n_table = len(re.findall(rb"^CREATE TABLE ", data, re.M))
        n_data = len(re.findall(rb"^(COPY |INSERT INTO )", data, re.M))
        tail = data[-4096:].decode("utf-8", "replace")
        ok = "PostgreSQL database dump complete" in tail

        log("")
        log("=" * 64)
        log("本地校验")
        log("=" * 64)
        log(f"文件            {out_path}（{human(len(data))}）")
        log(f"CREATE TABLE    {n_table} 个")
        log(f"数据段(COPY/INSERT) {n_data} 个")
        log(f"结束标记        {'✓ 完整（dump complete）' if ok else '✗ 未找到，文件可能被截断'}")
        return 0 if (ok and n_table > 0) else 1

    except Exception as exc:  # noqa: BLE001
        log(f"\n✗ 失败：{type(exc).__name__}: {exc}")
        return 1
    finally:
        if client is not None:
            # 清理远端临时文件（尽力而为，失败不影响结果）
            try:
                sftp = client.open_sftp()
                for p in (REMOTE_SQL, REMOTE_ERR, "/root/_colorai_run.sh", "/root/_colorai_run.out"):
                    try:
                        sftp.remove(p)
                    except IOError:
                        pass
                sftp.close()
            except Exception:
                pass
            client.close()


if __name__ == "__main__":
    sys.exit(main())
