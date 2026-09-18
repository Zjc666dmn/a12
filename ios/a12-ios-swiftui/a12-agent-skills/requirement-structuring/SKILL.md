---
name: requirement-structuring
description: Parse a teaching request into structured fields (subject, audience, duration, objectives, topics, interaction form) as the first step of every generation pipeline.
---

# Requirement Structuring

将用户的原始教学需求文本解析为标准化结构，供后续 RAG 检索和内容生成使用。

## 输入

- `prompt`: 用户原始输入文本（中文或英文）
- `artifactType`: `deck | lessonPlan | game | animation` 之一

## 输出

返回 JSON 对象：

```json
{
  "subject": "人工智能导论",
  "audience": "大一学生",
  "durationMinutes": 45,
  "objectives": ["理解 AI 基本概念", "能识别生活中的 AI 应用"],
  "topics": ["什么是人工智能", "AI 如何学习", "AI 决策链"],
  "interactionForm": "4人小组课堂互动",
  "missingFields": []
}
```

## 规则

- 无法从 prompt 推断的字段按 artifactType 的默认 prompt 模板填充；仍无法确定时写入 `missingFields`。
- 用户明确给出的值优先于默认值，不要覆盖。
- `objectives` 保持 2-5 条；`topics` 保持 3-6 个。
- `missingFields` 非空时，由 task-orchestration 决定是否调用 conversational-clarification。
