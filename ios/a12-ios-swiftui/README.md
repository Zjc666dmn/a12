# A12 Teaching Agent iOS App

这是 A12「多模态 AI 互动式教学智能体」的苹果 App 版前端源码工程。工程使用 SwiftUI 编写，可直接用 Xcode 打开 `A12TeachingAgent.xcodeproj`。

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
- `A12TeachingAgent/Services/PiAgentClient.swift`：Pi Agent 后端接口占位层。

## 已实现能力

- 首页：与网页移动端一致的 AI 助手、快速开始区和四个产物类型（课件 PPT、Word 教案、互动小游戏、课堂动画）。
- Studio：对话流、生成进度、18 页课件预览、初始大纲、文件列表和修改意见。
- 文件：支持通过系统文件选择器添加参考资料，并展示上传文件与默认产物文件。
- 项目：展示 AI 导论课、机器学习入门和课堂互动小游戏等项目。
- 知识库：展示 RAG 切片、教材资料、视频摘要和课程大纲。
- 我的：展示 Pi Agent 连接状态、模型设置、导出设置和团队空间。
- 状态管理：使用 `A12AppState` 模拟真实任务创建、生成、修改和提示反馈。
- 后端预留：`PiAgentClient` 可替换为真实 Pi Agent API、SSE/WebSocket 流式状态和文件下载接口。

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
