---
name: file-export-download
description: Package generated artifacts into downloadable PPTX, DOCX, HTML files or a single ZIP archive.
---

# File Export & Download

将生成产物打包为可下载文件。

## 输入

- `taskID`
- `formats`: `pptx | docx | html` 的子集数组
- `bundle`: 布尔值；`true` 时额外返回单个 ZIP

## 输出

```json
{
  "downloadUrls": [
    { "format": "pptx", "url": "https://.../AI_导论课件.pptx", "sizeBytes": 2048000 },
    { "format": "docx", "url": "https://.../AI_导论教案.docx", "sizeBytes": 512000 }
  ],
  "bundleUrl": "https://.../A12_课堂包_abc123.zip"
}
```

## 规则

- PPTX：用 deck pages 结构渲染（python-pptx 或等价工具）。
- DOCX：用 lesson plan sections 渲染（python-docx 或等价工具）。
- HTML：game HTML 原样返回。
- ZIP：文件名格式 `A12_课堂包_{taskID前8位}.zip`，包含所有请求的文件。
- 下载链接有效期至少 24 小时。
