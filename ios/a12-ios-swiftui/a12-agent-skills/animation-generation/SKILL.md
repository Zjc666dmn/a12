---
name: animation-generation
description: Generate a short classroom animation storyboard or rendered video explaining a knowledge point.
---

# Animation Generation

根据课程内容简报生成知识点动画的分镜脚本或渲染视频。

## 输入

- `contentBrief`: knowledge-fusion 的输出
- `durationSeconds`: 默认 60

## 输出

```json
{
  "storyboard": [
    {
      "scene": "场景 1",
      "narration": "想象你每天早上走进校园，门禁系统的摄像头认出了你，自动打开了大门。",
      "visualDescription": "学生走向校门，人脸识别框出现在画面中",
      "durationSeconds": 8
    }
  ],
  "videoUrl": "https://.../知识点动画.mp4"
}
```

## 规则

- 旁白总字数按每秒 4 个中文字匹配目标时长。
- 每个场景时长 5-15 秒。
- 视觉描述使用简报中的校园生活案例。
- 如渲染后端暂不可用，只返回 `storyboard`，不返回 `videoUrl`。
