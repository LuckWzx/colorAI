"""P0-2 BGE-M3 薄封装（硅基流动 OpenAI 兼容接口，见设计文档 §3.1）。

- BGE-M3 **不加查询指令前缀**（与 bge-base-zh-v1.5 不同）；
- 分批调用，按返回 index 对齐（防御性）；
- 失败重试后仍异常 → EmbeddingError，绝不静默丢块。
"""
from __future__ import annotations

from openai import OpenAI

from app.config import settings


class EmbeddingError(Exception):
    """向量化失败（宁可报错退出，绝不静默丢块）"""


class BGE3Embedder:
    """BGE-M3（硅基流动）。文档与查询同一编码方式，均不加前缀。"""

    def __init__(self) -> None:
        self._client = OpenAI(
            base_url=settings.EMBEDDING_API_BASE,       # https://api.siliconflow.cn/v1
            api_key=settings.EMBEDDING_API_KEY,
            timeout=30.0,
            max_retries=2,                              # SDK 自带指数退避
        )
        self._model = settings.EMBEDDING_MODEL          # BAAI/bge-m3
        self._batch = settings.EMBEDDING_BATCH_SIZE     # 32

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), self._batch):
            batch = texts[i:i + self._batch]
            try:
                resp = self._client.embeddings.create(model=self._model, input=batch)
            except Exception as e:  # noqa: BLE001
                raise EmbeddingError(f"第 {i // self._batch + 1} 批（{len(batch)} 条）失败: {e}") from e
            vecs = [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]
            if len(vecs) != len(batch):
                raise EmbeddingError(f"第 {i // self._batch + 1} 批返回 {len(vecs)} 条 ≠ 输入 {len(batch)} 条")
            if vecs and len(vecs[0]) != settings.EMBEDDING_DIM:
                raise EmbeddingError(f"向量维度 {len(vecs[0])} ≠ EMBEDDING_DIM={settings.EMBEDDING_DIM}")
            out.extend(vecs)
        return out

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]
