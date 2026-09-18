---
name: lesson-plan-generation
description: Generate a Word lesson plan document structure from a course content brief.
---

# Lesson Plan Generation

根据课程内容简报生成 Word 教案的完整结构。

## 输入

- `contentBrief`: knowledge-fusion 的输出

## 输出

```json
{
  "sections": [
    { "heading": "教学目标", "body": "1. 理解…" },
    { "heading": "学情分析", "body": "…" },
    { "heading": "教学重点与难点", "body": "…" },
    { "heading": "教学过程", "body": "…" },
    { "heading": "课堂活动", "body": "…" },
    { "heading": "评价方式", "body": "…" },
    { "heading": "课后作业", "body": "…" }
  ],
  "docxUrl": "https://.../AI_导论教案.docx"
}
```

## 规则

- 七个板块缺一不可，顺序固定。
- 教学过程中各环节时间分配之和必须等于课程总时长。
- 总字数控制在 1200-2000 中文字符。
- 如渲染后端暂不可用，只返回 `sections` 结构，不返回 `docxUrl`。
