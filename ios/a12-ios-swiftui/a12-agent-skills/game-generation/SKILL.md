---
name: game-generation
description: Generate a self-contained HTML5 interactive classroom game from a course content brief.
---

# Game Generation

根据课程内容简报生成可直接在浏览器运行的 HTML5 课堂互动小游戏。

## 输入

- `contentBrief`: knowledge-fusion 的输出
- `groupSize`: 默认 4
- `durationMinutes`: 默认 20

## 输出

```json
{
  "gameTitle": "AI 决策链挑战",
  "rules": ["每轮 30 秒", "四组轮流答题", "答对 +10 分"],
  "playerRoles": ["数据采集员", "模型训练员", "结果检验员", "队长"],
  "htmlUrl": "https://.../课堂互动小游戏.html"
}
```

## 规则

- 生成单个自包含 HTML 文件，零外部依赖，可离线运行。
- 界面包含：倒计时、四组分数板、重新开始按钮。
- 按投影仪/共享屏幕设计，四组角色按钮清晰可见。
- 游戏机制必须直接练习本节课的核心知识点。
- 界面语言与课程受众一致（默认中文）。
