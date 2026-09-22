"""kb_chunks / kb_colors / kb_builds 存储层（P0 全量重建，见设计文档 §2 / §7）。

- rebuild：一个事务内 TRUNCATE 两表 + 全量插入 + 追加审计行；失败自动回滚、
  期间旧快照可查（MVCC）；
- kb_builds 只在成功后追加，不参与清表；
- embedding 用 pgvector 文本字面量直传，无需额外适配包（§3.2）。
"""
from __future__ import annotations

import psycopg
from psycopg.types.json import Jsonb

from app.config import settings
from app.knowledge.ingest import Chunk, ColorRow


def _conn() -> psycopg.Connection:
    return psycopg.connect(
        host=settings.PG_HOST, port=settings.PG_PORT, user=settings.PG_USER,
        password=settings.PG_PASSWORD, dbname=settings.PG_DB,
        sslmode=settings.PG_SSLMODE, connect_timeout=10,
    )


def _vec_literal(v: list[float]) -> str:
    """pgvector 文本字面量 '[0.1,0.2,…]'（8 位小数，足够 float4 精度）。"""
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


def rebuild(
    chunks: list[Chunk],
    colors: list[ColorRow],
    embeddings: list[list[float]],
    build_meta: dict,
) -> int:
    """全量重建。build_meta: {model, dim, sources:[{path, sha256, bytes}]}"""
    if len(chunks) != len(embeddings):
        raise ValueError(f"chunks({len(chunks)}) 与 embeddings({len(embeddings)}) 数量不一致")
    s = settings.PG_SCHEMA
    with _conn() as conn:                       # 事务：异常自动 rollback
        with conn.cursor() as cur:
            cur.execute(f"TRUNCATE {s}.kb_chunks, {s}.kb_colors RESTART IDENTITY")
            cur.executemany(
                f"INSERT INTO {s}.kb_chunks "
                "(source, section, kind, hex, content, content_hash, embedding) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                [
                    (c.source, c.section, c.kind, c.hex, c.content, c.content_hash, _vec_literal(e))
                    for c, e in zip(chunks, embeddings)
                ],
            )
            cur.executemany(
                f"INSERT INTO {s}.kb_colors (hex, name, family, meaning, scenes, source) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                [(r.hex, r.name, r.family, r.meaning, r.scenes, r.source) for r in colors],
            )
            cur.execute(
                f"INSERT INTO {s}.kb_builds (model, dim, n_chunks, n_colors, sources) "
                "VALUES (%s, %s, %s, %s, %s)",
                (build_meta["model"], build_meta["dim"], len(chunks), len(colors),
                 Jsonb(build_meta["sources"])),
            )
    return len(chunks)


def verify() -> dict:
    """回读校验：行数 / embedding 非空数 / 构建审计。"""
    s = settings.PG_SCHEMA
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT count(*), count(embedding) FROM {s}.kb_chunks")
            n_chunks, n_embedded = cur.fetchone()
            cur.execute(f"SELECT count(*) FROM {s}.kb_colors")
            n_colors = cur.fetchone()[0]
            cur.execute(f"SELECT count(*) FROM {s}.kb_builds")
            n_builds = cur.fetchone()[0]
            cur.execute(
                f"SELECT built_at, model, dim, n_chunks, n_colors "
                f"FROM {s}.kb_builds ORDER BY id DESC LIMIT 1"
            )
            last_build = cur.fetchone()
    return {"chunks": n_chunks, "embedded": n_embedded,
            "colors": n_colors, "builds": n_builds, "last_build": last_build}


def search_chunks(embedding: list[float], top_k: int) -> list[tuple]:
    """向量检索 kb_chunks（§3.2）。返回 [(kind, section, source, content, score), …]。"""
    s = settings.PG_SCHEMA
    vec = _vec_literal(embedding)
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT kind, section, source, content, 1 - (embedding <=> %s::vector) AS score "
                f"FROM {s}.kb_chunks WHERE embedding IS NOT NULL "
                f"ORDER BY embedding <=> %s::vector LIMIT %s",
                (vec, vec, top_k),
            )
            return cur.fetchall()


def list_families() -> list[str]:
    """全部色系规范名（10 个，供 family 别名归一化匹配）。"""
    s = settings.PG_SCHEMA
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT DISTINCT family FROM {s}.kb_colors ORDER BY 1")
            return [r[0] for r in cur.fetchall()]


def lookup_colors(hex_value: str | None = None, families: list[str] | None = None,
                  name: str | None = None, limit: int = 60) -> list[tuple]:
    """kb_colors 查询（多条件按「与」收窄）。

    返回 [(total, hex, name, family, meaning, scenes, source), …]，
    第一列为命中总数（不受 limit 影响，供 matched / truncated 判定）。
    """
    s = settings.PG_SCHEMA
    conds: list[str] = []
    params: list = []
    if hex_value:
        conds.append("upper(hex) = upper(%s)")
        params.append(hex_value)
    if families:
        conds.append("family = ANY(%s)")
        params.append(list(families))
    if name:
        conds.append("name LIKE %s")
        params.append(f"%{name}%")
    if not conds:
        return []
    where = " AND ".join(conds)
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT count(*) OVER () AS total, hex, name, family, meaning, scenes, source "
                f"FROM {s}.kb_colors WHERE {where} "
                f"ORDER BY family, hex LIMIT %s",
                (*params, limit),
            )
            return cur.fetchall()
