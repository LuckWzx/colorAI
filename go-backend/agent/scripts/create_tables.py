"""创建 colorai_kb schema 与三张表 —— RAG 知识库建表脚本（P0-3）。

DDL 与 doc/RAG知识库设计.md §2 保持一致（表 / 索引 / 全部 COMMENT ON），
全部语句幂等（IF NOT EXISTS / COMMENT ON 覆盖式），可反复执行。

跑法：
    cd go-backend/agent
    ./.venv/Scripts/python.exe scripts/create_tables.py

连接参数来自 app.config.settings（即 agent/.env 的 PG_* 键），不硬编码。
"""
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 保证无论从哪个目录调用：settings 的 env_file=".env" 是相对 CWD 的
AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))
os.chdir(AGENT_ROOT)

import psycopg  # noqa: E402
from app.config import settings  # noqa: E402

TABLES = ("kb_chunks", "kb_colors", "kb_builds")


def build_ddl(schema: str, vec_schema: str) -> list[str]:
    """生成全部 DDL（与 doc/RAG知识库设计.md §2 一致）。

    与文档唯一的差异：vector 类型用全限定名 {vec_schema}.vector(768)，
    避免受连接 search_path 影响而找不到类型。
    """
    v = f"{vec_schema}.vector(768)"
    return [
        # --- schema ---
        f"CREATE SCHEMA IF NOT EXISTS {schema}",
        # --- kb_chunks ---
        f"""CREATE TABLE IF NOT EXISTS {schema}.kb_chunks (
  id           BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,
  section      TEXT,
  kind         TEXT NOT NULL,
  hex          TEXT,
  content      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding    {v},
  meta         JSONB NOT NULL DEFAULT '{{}}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)""",
        f"CREATE INDEX IF NOT EXISTS idx_kb_chunks_kind ON {schema}.kb_chunks(kind)",
        f"CREATE INDEX IF NOT EXISTS idx_kb_chunks_src  ON {schema}.kb_chunks(source)",
        f"CREATE INDEX IF NOT EXISTS idx_kb_chunks_hex  ON {schema}.kb_chunks(hex) WHERE hex IS NOT NULL",
        f"COMMENT ON TABLE {schema}.kb_chunks IS '知识库文本块：单色块（color）/ 色系块（family）/ 问答块（qa）'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.id IS '自增主键，不承载语义（任何逻辑不得依赖具体值）'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.source IS '来源文件：寓意宝典 | 问答1000题'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.section IS '所属分节：色系规范名（color / family 块）或问答分类原文（qa 块）'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.kind IS '块类型：color 单色 | family 色系 | qa 问答'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.hex IS '色值，仅 kind=color 块有值'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.content IS '块正文，由源文件字段机械拼接、不作改写（拼法见设计文档 §1.3）'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.content_hash IS 'content 的 sha256；P0 暂不承担功能（审计 + 后期增量锚点）'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.embedding IS 'BGE 向量：bge-base-zh-v1.5，768 维，已归一化'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.meta IS '扩展元数据（JSONB），无强制字段'",
        f"COMMENT ON COLUMN {schema}.kb_chunks.updated_at IS '行更新时间'",
        # --- kb_colors ---
        f"""CREATE TABLE IF NOT EXISTS {schema}.kb_colors (
  hex     TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  family  TEXT NOT NULL,
  meaning TEXT NOT NULL,
  scenes  TEXT NOT NULL,
  source  TEXT NOT NULL DEFAULT '寓意宝典'
)""",
        f"CREATE INDEX IF NOT EXISTS idx_kb_colors_family ON {schema}.kb_colors(family)",
        f"COMMENT ON TABLE {schema}.kb_colors IS '结构化色值：每色一行，供精确查询（不进向量检索）'",
        f"COMMENT ON COLUMN {schema}.kb_colors.hex IS '十六进制色值（自然主键，查询大小写不敏感）'",
        f"COMMENT ON COLUMN {schema}.kb_colors.name IS '颜色名称'",
        f"COMMENT ON COLUMN {schema}.kb_colors.family IS '所属色系规范名（10 个之一，如 红色系）'",
        f"COMMENT ON COLUMN {schema}.kb_colors.meaning IS '核心寓意'",
        f"COMMENT ON COLUMN {schema}.kb_colors.scenes IS '适用场景'",
        f"COMMENT ON COLUMN {schema}.kb_colors.source IS '数据来源'",
        # --- kb_builds ---
        f"""CREATE TABLE IF NOT EXISTS {schema}.kb_builds (
  id       BIGSERIAL PRIMARY KEY,
  built_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model    TEXT NOT NULL,
  dim      INTEGER NOT NULL,
  n_chunks INTEGER NOT NULL,
  n_colors INTEGER NOT NULL,
  sources  JSONB NOT NULL
)""",
        f"COMMENT ON TABLE {schema}.kb_builds IS '构建审计：每次入库成功后追加一条，答「当前索引对应哪版源文件」'",
        f"COMMENT ON COLUMN {schema}.kb_builds.id IS '自增主键'",
        f"COMMENT ON COLUMN {schema}.kb_builds.built_at IS '构建时间'",
        f"COMMENT ON COLUMN {schema}.kb_builds.model IS 'embedding 模型名（换模型必须全量重建）'",
        f"COMMENT ON COLUMN {schema}.kb_builds.dim IS '向量维度（与 embedding 列一致）'",
        f"COMMENT ON COLUMN {schema}.kb_builds.n_chunks IS '本次构建块数（当前语料 = 1,320，用于完整性核对）'",
        f"COMMENT ON COLUMN {schema}.kb_builds.n_colors IS '本次构建色值数（当前语料 = 310）'",
        f"COMMENT ON COLUMN {schema}.kb_builds.sources IS '源文件指纹数组：[{{path, sha256, bytes}}]'",
    ]


def main() -> int:
    cfg = settings
    print(f"目标: {cfg.PG_USER}@{cfg.PG_HOST}:{cfg.PG_PORT}/{cfg.PG_DB}  "
          f"schema={cfg.PG_SCHEMA}  sslmode={cfg.PG_SSLMODE}")
    if not cfg.PG_PASSWORD:
        print("[!!] PG_PASSWORD 为空 —— 请先在 agent/.env 填好 PG_* 配置")
        return 1

    try:
        conn = psycopg.connect(
            host=cfg.PG_HOST, port=cfg.PG_PORT, user=cfg.PG_USER,
            password=cfg.PG_PASSWORD, dbname=cfg.PG_DB,
            sslmode=cfg.PG_SSLMODE, connect_timeout=10,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[!!] 连接失败: {type(e).__name__}: {e}")
        return 1
    print("[OK] 连接成功")

    try:
        with conn:
            with conn.cursor() as cur:
                # 1) pgvector 必须在（embedding 列依赖它）
                cur.execute(
                    "SELECT n.nspname, e.extversion FROM pg_extension e "
                    "JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'vector'"
                )
                row = cur.fetchone()
                if not row:
                    print("[!!] pgvector 扩展未安装 —— embedding 列无法创建")
                    return 1
                vec_schema, vec_version = row
                print(f"[OK] pgvector {vec_version} @ {vec_schema}")

                # 2) 记录执行前的表状态（用于区分「新建」与「已存在」）
                cur.execute(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = %s AND table_name = ANY(%s)",
                    (cfg.PG_SCHEMA, list(TABLES)),
                )
                before = {r[0] for r in cur.fetchall()}

                # 3) 执行全部 DDL（同一事务，中途失败自动回滚）
                ddl = build_ddl(cfg.PG_SCHEMA, vec_schema)
                for stmt in ddl:
                    cur.execute(stmt)
                print(f"[OK] 已执行 {len(ddl)} 条 DDL（CREATE SCHEMA/TABLE/INDEX + COMMENT）")

                # 4) 验证
                print("\n--- 验证 ---")
                cur.execute(
                    "SELECT table_name, count(*) FROM information_schema.columns "
                    "WHERE table_schema = %s AND table_name = ANY(%s) "
                    "GROUP BY 1 ORDER BY 1",
                    (cfg.PG_SCHEMA, list(TABLES)),
                )
                cols = dict(cur.fetchall())
                for t in TABLES:
                    state = "已存在" if t in before else "新建"
                    print(f"  [{'OK' if t in cols else '!!'}] {t}: {cols.get(t, 0)} 列（{state}）")

                for subid_cond, label, expect in (
                    ("d.objsubid = 0", "表注释", 3),
                    ("d.objsubid > 0", "列注释", 23),
                ):
                    cur.execute(
                        "SELECT count(*) FROM pg_description d "
                        "JOIN pg_class c ON c.oid = d.objoid "
                        "JOIN pg_namespace n ON n.oid = c.relnamespace "
                        f"WHERE n.nspname = %s AND c.relname = ANY(%s) AND {subid_cond}",
                        (cfg.PG_SCHEMA, list(TABLES)),
                    )
                    n = cur.fetchone()[0]
                    print(f"  [{'OK' if n == expect else '!!'}] {label} {n}/{expect}")

                cur.execute(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = %s "
                    "AND tablename = ANY(%s) ORDER BY 1",
                    (cfg.PG_SCHEMA, list(TABLES)),
                )
                idx = [r[0] for r in cur.fetchall()]
                print(f"  [OK] 索引 {len(idx)} 个: {', '.join(idx)}")
    except psycopg.Error as e:
        print(f"[!!] DDL 执行失败（事务已回滚）: {e}")
        return 1
    finally:
        conn.close()

    print("\n完成：schema 与三张表就绪")
    return 0


if __name__ == "__main__":
    sys.exit(main())
