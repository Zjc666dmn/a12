---
name: knowledge-fusion
description: Merge retrieved RAG chunks with the structured requirement into a unified course content brief for downstream generators.
---

# Knowledge Fusion

将结构化需求与检索到的知识片段合成为统一的课程内容简报。

## 输入

- `requirements`: requirement-structuring 的输出
- `chunks`: rag-retrieval 的输出

## 输出

```json
{
  "outline": [
    { "section": "什么是人工智能", "points": ["校园刷脸", "推荐系统"] }
  ],
  "examples": ["食堂客流预测", "学习平台推荐"],
  "activityDesign": "4人小组识别校园场景中的 AI 决策链",
  "sourceAttribution": { "chunksUsed": ["uuid1", "uuid2"], "conflicts": [] }
}
```

## 规则

- 简报中的每个事实性陈述必须能追溯到至少一个 chunk 或用户自己的 prompt。
- 检索结果之间有冲突时，在 `sourceAttribution.conflicts` 中标注，不要自行取舍。
- 总长度控制在 2000 token 以内，避免下游生成器超载。
