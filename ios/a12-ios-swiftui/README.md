# TeachNova iOS App

这是 TeachNova「多模态 AI 互动式教学智能体」的苹果 App 版前端源码工程。工程使用 SwiftUI 编写，可直接用 Xcode 打开 `A12TeachingAgent.xcodeproj`。

## 打开方式

1. 双击 `A12TeachingAgent.xcodeproj`。
2. 在 Xcode 顶部选择 `A12TeachingAgent` scheme。
3. 选择 iPhone 模拟器或真机。
4. 点击 Run。

## 工程结构

- `A12TeachingAgent/A12TeachingAgentApp.swift`：App 入口。
- `A12TeachingAgent/ContentView.swift`：底部 Tab 与全局 Toast。
- `A12TeachingAgent/Models/AppModels.swift`：产物类型、项目产物、对话消息和全局状态。
- `A12TeachingAgent/Views/HomeView.swift`：首页创建入口、产物分类、输入框、生成按钮。
- `A12TeachingAgent/Views/StudioView.swift`：对话、预览、文件三个工作台页面。
- `A12TeachingAgent/Views/SecondaryViews.swift`：项目、知识库、我的页面。
- `A12TeachingAgent/Views/Rows.swift`：对话气泡、流程行、文件行等复用组件。
- `A12TeachingAgent/Services/PiAgentClient.swift`：国内模型兼容接口、Keychain 密钥存储和导出文件服务。
- `A12TeachingAgent/Services/SpeechRecognitionService.swift`：中文语音听写和麦克风权限处理。

## 已实现能力

- 首页：课件、教案、小游戏、知识库、全部模式切换。
- Studio：对话流、生成进度、课件预览、文件列表、修改意见。
- 项目：展示已生成的 PPTX、DOCX、HTML5 课堂包。
- 知识库：首装预置教育部、上海教育、北京市教育部门、中国教育学会和 UNESCO 的真实公开资料；按政策指南、课程标准、教学实践、伦理安全、资源平台分类，能整理的来源直接展示提取要点，难以提取的保留原网页链接。
- 我的：展示智能体连接状态、模型设置、导出设置和团队空间。
- 状态管理：使用 `A12AppState` 模拟真实任务创建、生成、修改和提示反馈。
- 模型直连：默认 DeepSeek，也支持通义千问、智谱 GLM、Kimi、百度文心；在“我的 → 模型与智能体”选择模型并填写 API Key 即可测试连接。
- 安全存储：API Key 使用系统 Keychain 保存，不写入工程文件或 UserDefaults。
- 导出设置：可选择默认格式、是否附带知识库来源，并生成可分享的 HTML5 / Markdown 内容预览；接入 PPTX/DOCX 生成服务后可扩展为原生办公文件。
- 团队空间：支持本地保存团队名称、成员和角色，可添加或移除成员。
- 语音输入：首页需求框和 Studio 修改框均支持中文语音听写，首次使用会请求麦克风和语音识别权限。
- 资料导入：支持多选导入 PDF、DOCX、PPTX、TXT、MD、CSV，文件会复制到应用沙盒并在“知识库”中持久化展示；文本文件会即时读取摘要。
- 网页来源：链接和公开元数据会保存在本机，后续打开知识库即可再次进入；网页正文仍以原站最新内容为准。

## 验证结果

已执行 Xcode 构建验证：

```bash
xcodebuild -project outputs/a12-ios-swiftui/A12TeachingAgent.xcodeproj \
  -scheme A12TeachingAgent \
  -destination 'generic/platform=iOS' \
  -derivedDataPath work/a12-derived-data-device \
  build CODE_SIGNING_ALLOWED=NO
```

结果：`BUILD SUCCEEDED`。

## 交付建议

正式提交时建议同时提交：

- `a12-ios-swiftui.tar.gz`：苹果 App 版 SwiftUI 原生前端源码。
- `a12-ios-frontend.tar.gz`：可直接用浏览器展示的高保真演示页面。

这样既有可运行演示，也有 iOS 原生工程代码支撑。
