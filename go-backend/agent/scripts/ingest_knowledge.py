"""P0-4 入库编排：解析 → 断言 → 向量化 → 全量重建写库。

用法：
    cd go-backend/agent
    ./.venv/Scripts/python.exe scripts/ingest_knowledge.py            # 正式入库
    ./.venv/Scripts/python.exe scripts/ingest_knowledge.py --dry-run  # 只解析+断言（0 成本）

验证口径（§8 P0-4）：连跑两次 → 两次块数/内容一致（允许 embedding 重算）。
"""
import argparse
import hashlib
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))
os.chdir(AGENT_ROOT)

from app.config import settings  # noqa: E402
from app.knowledge import ingest, store  # noqa: E402
from app.knowledge.embedder import BGE3Embedder, EmbeddingError  # noqa: E402

DOC_DIR = AGENT_ROOT / "doc"
SOURCE_FILES = ("颜色寓意全息宝典.md", "颜色知识问答1000题.md")


def fingerprint(path: Path) -> dict:
    data = path.read_bytes()
    return {"path": f"doc/{path.name}",
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data)}


def main() -> int:
    ap = argparse.ArgumentParser(description="RAG 知识库入库（P0 全量重建）")
    ap.add_argument("--dry-run", action="store_true",
                    help="只解析+断言，不向量化、不入库")
    args = ap.parse_args()

    # ---- 1) 解析 + 断言 ----
    print("--- 1/4 解析切块 ---")
    try:
        chunks, colors = ingest.parse_all(DOC_DIR)
    except ingest.IngestError as e:
        print(f"[!!] 解析断言失败：{e}")
        return 1
    n_color = sum(1 for c in chunks if c.kind == "color")
    n_family = sum(1 for c in chunks if c.kind == "family")
    n_qa = sum(1 for c in chunks if c.kind == "qa")
    print(f"  [OK] 块数 {len(chunks)}（color {n_color} / family {n_family} / qa {n_qa}），"
          f"色值行 {len(colors)}")

    if args.dry_run:
        for c in (chunks[0], chunks[-1]):
            preview = c.content.replace("\n", " ⏎ ")
            print(f"  [sample] kind={c.kind} section={c.section} :: {preview[:90]}...")
        print("\ndry-run：解析通过，未向量化、未入库")
        return 0

    # ---- 2) 向量化 ----
    print("--- 2/4 向量化（硅基流动 BGE-M3）---")
    try:
        embedder = BGE3Embedder()
        embeddings = embedder.embed_documents([c.content for c in chunks])
    except EmbeddingError as e:
        print(f"[!!] 向量化失败：{e}")
        return 1
    print(f"  [OK] {len(embeddings)} 条 × {len(embeddings[0])} 维")

    # ---- 3) 全量重建写库 ----
    print("--- 3/4 全量重建写库 ---")
    fingerprints = [fingerprint(DOC_DIR / name) for name in SOURCE_FILES]
    try:
        n = store.rebuild(chunks, colors, embeddings, {
            "model": settings.EMBEDDING_MODEL,
            "dim": settings.EMBEDDING_DIM,
            "sources": fingerprints,
        })
    except Exception as e:  # noqa: BLE001
        print(f"[!!] 写库失败（事务已回滚）：{type(e).__name__}: {e}")
        return 1
    print(f"  [OK] kb_chunks {n} 行 / kb_colors {len(colors)} 行 / kb_builds +1（事务提交）")

    # ---- 4) 回读校验 ----
    print("--- 4/4 回读校验 ---")
    stats = store.verify()
    print(f"  [OK] kb_chunks={stats['chunks']}（embedding 非空 {stats['embedded']}）"
          f"  kb_colors={stats['colors']}")
    if stats["last_build"]:
        built_at, model, dim, nc, ncol = stats["last_build"]
        print(f"  [OK] 最近构建：{built_at:%Y-%m-%d %H:%M:%S}  {model}  dim={dim}  "
              f"chunks={nc}  colors={ncol}（kb_builds 共 {stats['builds']} 条）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
