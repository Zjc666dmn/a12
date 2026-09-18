---
name: rag-retrieval
description: Retrieve the most relevant knowledge segments from the local vector index for a given teaching requirement.
---

# RAG Retrieval

在本地知识库向量索引中检索与教学需求最相关的片段。

## 输入

- `query`: 由 requirements 的 subject + topics + interactionForm 拼接而成
- `topK`: 默认 8
- `indexName`: 知识库标识

## 输出

```json
{
  "chunks": [
    {
      "segmentId": "uuid",
      "score": 0.87,
      "content": "片段文本",
      "sourceFile": "人工智能导论教材节选.pdf"
    }
  ]
}
```

## 规则

- 查询向量与索引向量使用同一个 embedding 模型。
- 分数低于 0.72 的结果丢弃；不足 topK 时返回实际数量。
- 返回前对内容近似重复的片段去重。
- 必须包含 `sourceFile`，iOS 端会展示出处。
