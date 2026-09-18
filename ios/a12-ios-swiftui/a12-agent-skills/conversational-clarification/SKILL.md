---
name: conversational-clarification
description: Ask the user targeted follow-up questions when required fields are missing from a teaching request.
---

# Conversational Clarification

在需求结构化后仍有字段缺失时，向用户发出有针对性的追问。

## 输入

- `missingFields`: requirement-structuring 输出中非空的字段名列表
- `partialRequirements`: 已推断出的部分结构化需求
- `chatHistory`: 最近对话消息列表

## 输出

```json
{
  "questions": ["课程时长是多少分钟？", "希望采用什么形式的课堂互动？"],
  "updatedRequirements": { }
}
```

## 规则

- 单次最多问 3 个问题。
- 优先级：subject > durationMinutes > interactionForm。
- 问题用中文表述，语气友好简洁，不用选择题格式。
- 用户回复后，将答案合并进 `updatedRequirements`，并将对应字段从 `missingFields` 中移除。
- 全部字段补齐后，`missingFields` 返回空数组，控制权交回 task-orchestration。
