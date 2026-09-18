# TeachNova PPTX Service

这个服务把 TeachNova 的页级大纲写成真正可被 PowerPoint、Keynote 或 LibreOffice 打开的 `.pptx` 文件；同时为 DOCX 文档提供文本提取接口。

```bash
cd tools/pptx-service
npm install
npm start
```

服务启动后，iOS 模拟器默认地址为 `http://localhost:8787/api/export/pptx`。生产环境请部署为 HTTPS 服务，并在 TeachNova 的“生成 PPT > PPTX 服务”中填写地址。

实现使用 [PptxGenJS](https://github.com/gitbrent/pptxgenjs) 生成可编辑的 PowerPoint 元素。PPT 流程的设计参考了 GitHub 上的 [ppt-generator skill](https://github.com/ddpie/agent-skills/tree/main/content/ppt-generator) 和 [powerpoint-ppt skill](https://github.com/PracticalSwan/agent-skills/tree/main/powerpoint-ppt)；这两个 Agent skill 不会被打包进 iOS App，而是将其“先编排内容、再生成文件、最后校验”的方法转化为项目内可运行服务。
