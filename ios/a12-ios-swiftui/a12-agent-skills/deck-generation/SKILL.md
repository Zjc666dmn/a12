---
name: deck-generation
description: Generate a multi-page PPT deck (slide structure and content) from a course content brief.
---

# Deck Generation

根据课程内容简报生成多页课件的结构与内容。

## 输入

- `contentBrief`: knowledge-fusion 的输出

## 输出

```json
{
  "pageCount": 18,
  "pages": [
    {
      "number": 1,
      "title": "什么是人工智能",
      "bullets": ["校园刷脸识别", "推荐系统", "语音助手"],
      "speakerNotes": "从学生每天使用的应用切入",
      "visualHint": "校园场景插画"
    }
  ],
  "pptxUrl": "https://.../AI_导论课件.pptx"
}
```

## 规则

- 45 分钟课程目标 12-20 页；其余按时长换算。
- 每页标题不超过 20 字；bullet 3-5 条，每条不超过 25 字。
- 必须包含：封面、目录、每个 topic 一页或多页、互动活动页、总结页、作业页。
- 如渲染后端暂不可用，只返回 `pages` 结构，不返回 `pptxUrl`。
