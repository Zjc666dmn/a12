---
name: revision-application
description: Apply a user's revision request to existing artifacts and regenerate only the affected parts.
---

# Revision Application

接收用户的修改意见，对已有产物做定向更新。

## 输入

- `revisionText`: 用户的修改请求文本
- `currentArtifacts`: 当前已有的 deck pages / lesson plan sections / game HTML / animation storyboard

## 输出

```json
{
  "changedSections": ["deck.pages[2-4]", "game.rules"],
  "updatedArtifacts": { },
  "changeSummary": "已将案例替换为校园场景，互动小游戏改为四人协作版本。"
}
```

## 规则

- 只重新生成 `revisionText` 明确涉及的段落或页面，其余保持不变。
- 修改完成后返回 `changeSummary`，iOS 端会将其作为 AI 消息追加到对话流。
- `changeSummary` 用一句自然的中文描述改动内容。
- 修改结果自动触发 task-status-streaming 推送 `artifact-ready` 事件。
