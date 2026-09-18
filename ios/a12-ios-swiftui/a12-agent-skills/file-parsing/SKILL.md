---
name: file-parsing
description: Extract text, keyframes, and summaries from uploaded PDF, image, video, or text files for knowledge indexing.
---

# File Parsing

将用户上传的参考资料解析为可向量化的文本段。

## 输入

- `files`: 数组，每项 `{ url, mimeType, sizeBytes }`

## 输出

```json
{
  "segments": [
    {
      "fileId": "uuid",
      "kind": "pdf|image|video|text",
      "content": "提取的文本",
      "pageOrTimestamp": "p.3 或 00:01:23",
      "summary": "该段摘要"
    }
  ]
}
```

## 规则

- PDF：按页提取文本，保留标题和列表结构。
- 图片：执行 OCR，返回识别文本。
- 视频：提取关键帧并转录音频，按时间段切分后逐段摘要。
- 文本：按段落切分；代码块保持完整不拆。
- 每段长度控制在 512 token 以内，适合向量索引。
- 返回整个文件的 `summary` 和解析耗时 `parseDurationMs`。
