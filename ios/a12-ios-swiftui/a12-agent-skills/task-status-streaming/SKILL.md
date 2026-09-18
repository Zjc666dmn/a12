---
name: task-status-streaming
description: Push real-time task progress events to the iOS client via SSE so the studio panel updates live.
---

# Task Status Streaming

将生成流水线的实时进度推送给 iOS 客户端。

## 传输方式

- 使用 SSE（Server-Sent Events）。
- 端点：`GET /api/tasks/{taskID}/stream`
- Content-Type: `text/event-stream`

## 事件格式

```
event: status
data: {"stage": "requirement-structuring", "state": "in-progress"}

event: status
data: {"stage": "requirement-structuring", "state": "completed"}

event: artifact-ready
data: {"type": "deck", "url": "https://.../AI_导论课件.pptx", "pageCount": 18}

event: done
data: {"taskID": "uuid", "generationState": "已完成"}
```

## 规则

- 每个流水线步骤开始时发送 `state: "in-progress"`，结束时发送 `state: "completed"`。
- 每当一个文件可下载时发送 `artifact-ready`。
- 所有请求的产物就绪后发送 `done`，然后关闭流。
- 出错时发送 `event: error`，`data` 中包含 `message` 字段，随后关闭流。
- 事件发送顺序必须与流水线执行顺序一致。
