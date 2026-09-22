"""color_lookup 工具：按色值 / 色系 / 颜色名查询 310 种精选颜色（P0-5，独立文件）。

数据源：颜色寓意全息宝典 → kb_colors（310 行，hex 主键，**不进向量检索** ——
BGE-M3 对 `#A52A2A` 这种十六进制串没语义，精确查询必须走 SQL，见设计文档 §2）。
设计见 doc/RAG知识库设计.md §4.1。

三条硬约定：
  1. `matched=0` 是**正常业务分支**（没有该色值/色系/名称 → LLM 不得编造色值），绝不 raise；
  2. hex 查询大小写不敏感、`#` 可省略（内部归一化为 `#RRGGBB`）；
  3. family 容忍简写（「青色系」→「青色/蓝绿系」；10 个色系中 2 个含 `/`，做别名匹配）。
"""
from __future__ import annotations

import psycopg
from langchain_core.tools import tool
from loguru import logger

from app.config import settings
from app.knowledge import store

_MAX_RESULTS = 60      # 单次返回上限（防 token 爆炸；红色系 42 条 < 60）


def _normalize_hex(value: str) -> str | None:
    """'ff0000' / '#FF0000' / ' #ff0000 ' → '#FF0000'；格式非法返回 None。"""
    v = value.strip().lstrip("#").upper()
    if len(v) != 6 or any(c not in "0123456789ABCDEF" for c in v):
        return None
    return f"#{v}"


def _family_aliases(family: str) -> set[str]:
    """色系别名集：'青色/蓝绿系' → {青色/蓝绿系, 青色, 蓝绿系, 青色系, 蓝绿}"""
    parts = [p.strip() for p in family.split("/")]
    aliases = {family, *parts}
    for p in parts:
        aliases.add(p[:-1] if p.endswith("系") else p + "系")
    return aliases


@tool
def color_lookup(hex_value: str | None = None, family: str | None = None,
                 name: str | None = None) -> dict:
    """按色值 / 色系 / 颜色名查询 310 种精选颜色的结构化信息（寓意、适用场景）。

    何时使用：用户提到具体色值（如 #A52A2A）、具体色系（如 红色系、青色系）、
    或具体颜色名（如 赤褐、正红、纯白）。

    重要约定：
      - matched=0 表示数据里没有匹配，**不得编造色值或寓意**；
      - 三个参数都可选，同时给出时按「与」过滤（如 family=红色系 + name=红）；
      - 单次最多返回 60 条（truncated=true 表示被截断）。

    Args:
        hex_value: 十六进制色值，如 "#A52A2A"（大小写不敏感、# 可省略）。
        family: 色系名，如 "红色系"、"青色系"（10 个色系之一，容忍简写）。
        name: 颜色名（模糊匹配），如 "正红"、"赤褐"。

    Returns:
        dict: {success, matched, results: [{hex, name, family, meaning, scenes, source}], truncated}
    """
    if not settings.KNOWLEDGE_ENABLED:
        return {"success": False, "error": "知识库功能未启用"}

    # ---- 参数归一化 ----
    hx: str | None = None
    if hex_value and hex_value.strip():
        hx = _normalize_hex(hex_value)
        if hx is None:
            return {"success": True, "matched": 0, "results": [], "truncated": False,
                    "note": f"hex_value 格式应为 #RRGGBB（收到 {hex_value!r}）；"
                            f"若用户给的是颜色名请改用 name 参数"}

    nm = name.strip() if name and name.strip() else None
    fam_input = family.strip().replace(" ", "") if family and family.strip() else None

    if hx is None and fam_input is None and nm is None:
        return {"success": True, "matched": 0, "results": [], "truncated": False,
                "note": "未提供任何查询参数（hex_value / family / name 至少给一个）"}

    try:
        families: list[str] | None = None
        if fam_input is not None:
            all_families = store.list_families()
            families = [f for f in all_families if fam_input in _family_aliases(f)]
            if not families:
                return {"success": True, "matched": 0, "results": [], "truncated": False,
                        "note": f"未知色系 {family!r}；可选：" + "、".join(all_families)}

        rows = store.lookup_colors(hex_value=hx, families=families,
                                   name=nm, limit=_MAX_RESULTS)
    except psycopg.Error as exc:
        logger.exception("[color_lookup] 数据库查询失败")
        return {"success": False, "error": f"知识库暂时不可用：{exc}"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[color_lookup] 未预期异常")
        return {"success": False, "error": f"色值查询失败: {exc}"}

    total = rows[0][0] if rows else 0
    results = [
        {"hex": r[1], "name": r[2], "family": r[3],
         "meaning": r[4], "scenes": r[5], "source": r[6]}
        for r in rows
    ]
    logger.debug(f"[color_lookup] hex={hx} family={families} name={nm} → {total} 条")
    return {"success": True, "matched": total, "results": results,
            "truncated": total > len(results)}
