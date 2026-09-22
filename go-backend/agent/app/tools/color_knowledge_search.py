"""color_knowledge_search 工具：色彩知识库语义检索（P0-5，独立文件）。

数据源：颜色知识问答1000题 + 颜色寓意宝典 → kb_chunks（1,320 块 × 1024 维向量）。
设计见 doc/RAG知识库设计.md §3 / §4。

三条硬约定：
  1. `results=[]` 是**正常业务分支**（库里没有 → LLM 应如实说明、不得凭记忆编造），
     与校色工具的 `passed=false` 同理：绝不 raise，`success` 恒为 True；
  2. 结果只经 `content` 字段交给 LLM 引用；不产出卡片（不在 TOOL_TYPE_MAPPING 里
     → type=text + metadata=None，防 1–2 KB 检索原文落库，见 agent.py §4.3）；
  3. 只返回 score ≥ RETRIEVAL_MIN_SCORE 的块（§6.4 校准），top_k 被 RETRIEVAL_MAX_K 截断。
"""
from __future__ import annotations

import psycopg
from langchain_core.tools import tool
from loguru import logger

from app.config import settings
from app.knowledge import store
from app.knowledge.embedder import BGE3Embedder, EmbeddingError

# 懒加载单例：首次调用时才构造客户端（避免 import 期副作用）
_embedder: BGE3Embedder | None = None


def _get_embedder() -> BGE3Embedder:
    global _embedder
    if _embedder is None:
        _embedder = BGE3Embedder()
    return _embedder


@tool
def color_knowledge_search(query: str, top_k: int = settings.RETRIEVAL_TOP_K) -> dict:
    """色彩知识库语义检索（理论 / 心理学 / 配色 / 文化象征 / 行业应用 / 颜色寓意）。

    何时使用：用户询问「什么是…」「为什么…」「…和…有什么区别」「…怎么配」
    「适合 X 的颜色」，以及与颜色的含义、象征、搭配、行业应用相关的任何问题。

    重要约定：
      - results 非空时：**只依据返回的 content 作答**，并注明 source 出处；
      - results 为空时：说明知识库未收录该内容，**绝对不要凭记忆编造**。

    Args:
        query: 用户问题原文（完整句子检索效果最好）。
        top_k: 返回条数，默认 5（上限 10，超出会被截断）。

    Returns:
        dict: {success, query, results: [{score, kind, section, source, content}], count}
    """
    if not settings.KNOWLEDGE_ENABLED:
        return {"success": False, "error": "知识库功能未启用"}

    q = (query or "").strip()
    if not q:
        return {"success": True, "query": q, "results": [], "count": 0}

    k = max(1, min(int(top_k), settings.RETRIEVAL_MAX_K))
    try:
        embedding = _get_embedder().embed_query(q)
        rows = store.search_chunks(embedding, k)
    except EmbeddingError as exc:
        logger.warning(f"[color_knowledge_search] 向量化失败: {exc}")
        return {"success": False, "error": f"向量化服务暂时不可用：{exc}"}
    except psycopg.Error as exc:
        logger.exception("[color_knowledge_search] 数据库查询失败")
        return {"success": False, "error": f"知识库暂时不可用：{exc}"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[color_knowledge_search] 未预期异常")
        return {"success": False, "error": f"知识检索失败: {exc}"}

    results = [
        {"score": round(score, 4), "kind": kind, "section": section,
         "source": source, "content": content}
        for kind, section, source, content, score in rows
        if score >= settings.RETRIEVAL_MIN_SCORE
    ]
    logger.debug(f"[color_knowledge_search] query={q!r} 命中 {len(results)}/{len(rows)} 条")
    return {"success": True, "query": q, "results": results, "count": len(results)}
