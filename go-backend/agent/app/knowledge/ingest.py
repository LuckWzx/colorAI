"""P0-1 解析与切块：两个源 md → 1,320 块 + 310 色值行。

规则见 doc/RAG知识库设计.md §1.2 / §1.3：
- content 一律由源文件字段**机械拼接**，不改写、不概括；
- 入库顺序 = 解析顺序（宝典：色系节序 → 节内颜色行序；问答：Q 编号序）；
- 任何数字对不上 → IngestError 报错退出（断言必须能失败，§6.2）。
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

# ---------- 正则（§1.2） ----------
RE_FAMILY_HEAD = re.compile(r"^## (.+?) · (.+?)（共 (\d+) 种）$")
RE_COLOR_ROW = re.compile(r"^\| `(#[0-9A-Fa-f]{6})` \| (.+?) \| (.+?) \| (.+?) \|$")
RE_QA_SECTION = re.compile(r"^## (.+)$")
RE_QA_Q = re.compile(r"^\*\*Q(\d+): (.+?)\*\*$")
RE_QA_A = re.compile(r"^A: (.+)$")

SOURCE_BAODIAN = "寓意宝典"
SOURCE_QA = "问答1000题"


class IngestError(Exception):
    """解析/断言失败（宁可 fail fast，绝不静默丢块）"""


@dataclass(slots=True)
class Chunk:
    source: str
    section: str
    kind: str          # 'color' | 'family' | 'qa'
    hex: str | None    # 仅 kind='color'
    content: str

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.content.encode("utf-8")).hexdigest()


@dataclass(slots=True)
class ColorRow:
    hex: str
    name: str
    family: str
    meaning: str
    scenes: str
    source: str = SOURCE_BAODIAN


def _norm_family(head: str) -> str:
    """'🔴 一、红色系' → '红色系'：剥离 emoji 与序号（取第一个 、 之后）。"""
    return head.split("、", 1)[1].strip() if "、" in head else head.strip()


def parse_baodian(path: Path) -> tuple[list[Chunk], list[ColorRow]]:
    """解析宝典 → (10 family + 310 color 块, 310 色值行)。"""
    chunks: list[Chunk] = []
    colors: list[ColorRow] = []

    family: str | None = None    # 当前色系规范名
    subtitle = ""                # 当前色系副标题
    declared = 0                 # 当前色系标题声明数
    names: list[str] = []        # 当前色系已收集的颜色名

    def close_family() -> None:
        """收尾上一色系：核验行数并生成 family 块（含全量名字，不截断）。"""
        if family is None:
            return
        if len(names) != declared:
            raise IngestError(f"色系「{family}」颜色行数 {len(names)} ≠ 标题声明 {declared}")
        chunks.append(Chunk(
            source=SOURCE_BAODIAN,
            section=family,
            kind="family",
            hex=None,
            content=f"{family} · {subtitle}（共 {declared} 种）\n包含颜色：{'、'.join(names)}",
        ))

    for line in path.read_text(encoding="utf-8").splitlines():
        m_head = RE_FAMILY_HEAD.match(line)
        if m_head:
            close_family()
            family = _norm_family(m_head.group(1))
            subtitle = m_head.group(2)
            declared = int(m_head.group(3))
            names = []
            continue
        m_row = RE_COLOR_ROW.match(line)
        if m_row:
            if family is None:
                raise IngestError(f"颜色行出现在色系标题之前：{line[:60]}")
            hx, name, meaning, scenes = m_row.groups()
            colors.append(ColorRow(hex=hx, name=name, family=family,
                                   meaning=meaning, scenes=scenes))
            chunks.append(Chunk(
                source=SOURCE_BAODIAN,
                section=family,
                kind="color",
                hex=hx,
                content=f"{family} · {name}（{hx}）\n寓意：{meaning}\n适用场景：{scenes}",
            ))
            names.append(name)
    close_family()
    return chunks, colors


def parse_qa(path: Path) -> list[Chunk]:
    """解析问答 1000 题 → 1,000 qa 块（一题一块，不切）。"""
    chunks: list[Chunk] = []
    section: str | None = None
    pending: tuple[int, str] | None = None   # (编号, 问题)
    nums: list[int] = []

    for line in path.read_text(encoding="utf-8").splitlines():
        m_sec = RE_QA_SECTION.match(line)
        if m_sec:
            if pending is not None:
                raise IngestError(f"Q{pending[0]} 缺少答案（遇到新分类「{m_sec.group(1)}」）")
            section = m_sec.group(1)
            continue
        m_q = RE_QA_Q.match(line)
        if m_q:
            if pending is not None:
                raise IngestError(f"Q{pending[0]} 缺少答案（遇到下一个 Q{m_q.group(1)}）")
            pending = (int(m_q.group(1)), m_q.group(2))
            nums.append(pending[0])
            continue
        m_a = RE_QA_A.match(line)
        if m_a:
            if pending is None:
                raise IngestError(f"答案没有对应的问题：{line[:60]}")
            if section is None:
                raise IngestError("Q/A 出现在分类标题之前")
            chunks.append(Chunk(
                source=SOURCE_QA,
                section=section,
                kind="qa",
                hex=None,
                content=f"Q: {pending[1]}\nA: {m_a.group(1)}",
            ))
            pending = None

    if pending is not None:
        raise IngestError(f"Q{pending[0]} 缺少答案（文件结束）")
    if nums != list(range(1, len(nums) + 1)):
        raise IngestError(f"Q 编号不连续：共 {len(nums)} 个，期望恰好 1..{len(nums)}")
    return chunks


def parse_all(doc_dir: Path) -> tuple[list[Chunk], list[ColorRow]]:
    """解析两文件并完成全部断言（§6.2），返回 (1,320 块, 310 色值行)。"""
    baodian_chunks, colors = parse_baodian(doc_dir / "颜色寓意全息宝典.md")
    qa_chunks = parse_qa(doc_dir / "颜色知识问答1000题.md")

    n_family = sum(1 for c in baodian_chunks if c.kind == "family")
    n_color = sum(1 for c in baodian_chunks if c.kind == "color")
    if n_family != 10:
        raise IngestError(f"色系块数 {n_family} ≠ 10")
    if n_color != 310:
        raise IngestError(f"颜色块数 {n_color} ≠ 310")
    if len(colors) != 310:
        raise IngestError(f"色值行数 {len(colors)} ≠ 310")
    if len({c.hex for c in colors}) != 310:
        raise IngestError("存在重复 hex 色值（与 kb_colors 主键冲突）")
    if len(qa_chunks) != 1000:
        raise IngestError(f"问答块数 {len(qa_chunks)} ≠ 1000")

    chunks = baodian_chunks + qa_chunks          # 入库顺序 = 解析顺序
    if len(chunks) != 1320:
        raise IngestError(f"总块数 {len(chunks)} ≠ 1320")
    return chunks, colors
