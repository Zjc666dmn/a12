---
name: task-orchestration
description: Route a structured teaching requirement through the correct generation pipeline and advance task state until all artifacts are ready.
---

# Task Orchestration

根据产物类型调度生成流水线，逐步推进任务状态。

## 输入

- `requirements`: requirement-structuring 的输出
- `artifactType`: `deck | lessonPlan | game | animation` 之一
- `uploadedFiles`: 已解析的文件 segment ID 列表（可选）

## 流水线

| artifactType | 执行顺序 |
|---|---|
| deck | requirement-structuring → rag-retrieval → knowledge-fusion → deck-generation |
| lessonPlan | requirement-structuring → rag-retrieval → knowledge-fusion → lesson-plan-generation |
| game | requirement-structuring → rag-retrieval → knowledge-fusion → game-generation |
| animation | requirement-structuring → rag-retrieval → knowledge-fusion → animation-generation |

## 规则

- 收到请求后立即返回 `taskID`，让 iOS 端可以导航到工作台页面。
- 每个步骤开始和结束时，通过 task-status-streaming 推送状态事件。
- 将中间输出存入任务记录，revision-application 可直接复用，避免重复检索和结构化。
- `missingFields` 非空且 artifactType 为 deck 或 lessonPlan 时，先调用 conversational-clarification。
