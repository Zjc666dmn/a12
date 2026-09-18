import Foundation
import SwiftUI

enum ArtifactType: String, CaseIterable, Identifiable {
    case deck = "课件 PPT"
    case lessonPlan = "Word 教案"
    case game = "互动小游戏"
    case animation = "课堂动画"

    var id: String { rawValue }

    var prompt: String {
        switch self {
        case .deck:
            return "我要做一节 45 分钟的人工智能导论课，面向大一学生，希望包含生活案例和一个课堂互动。"
        case .lessonPlan:
            return "请帮我生成一份人工智能导论课的 Word 教案，包含教学目标、学情分析、教学流程、课堂活动、评价方式和课后作业。"
        case .game:
            return "请设计一个适合 4 人小组参与的 AI 决策链课堂小游戏，能帮助学生理解数据输入、模型判断和行动反馈。"
        case .animation:
            return "请为人工智能导论课设计一个 60 秒知识点动画，解释数据、模型、训练和推理之间的关系。"
        }
    }

    var selectionToast: String {
        switch self {
        case .deck: return "已选择课件 PPT 生成模式"
        case .lessonPlan: return "已选择 Word 教案生成模式"
        case .game: return "已选择互动小游戏生成模式"
        case .animation: return "已选择课堂动画生成模式"
        }
    }

    var systemImage: String {
        switch self {
        case .deck: return "rectangle.on.rectangle"
        case .lessonPlan: return "doc.text"
        case .game: return "gamecontroller"
        case .animation: return "sparkles"
        }
    }
}

struct ProjectArtifact: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let subtitle: String
    let kind: String
    let systemImage: String
    var meta: String = ""
    var pageCount: Int = 18
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let text: String
    let isUser: Bool
}

struct OutlineItem: Identifiable {
    let id = UUID()
    let number: String
    let title: String
    let subtitle: String
}

struct UploadedFile: Identifiable {
    let id = UUID()
    let name: String
    let size: Int

    var kind: String {
        String(name.split(separator: ".").last?.prefix(3).uppercased() ?? "FILE")
    }

    var formattedSize: String {
        max(1, Int((Double(size) / 1024).rounded())).formatted() + "K"
    }
}

enum StudioPanel: String, CaseIterable, Identifiable {
    case conversation = "对话"
    case preview = "预览"
    case files = "文件"

    var id: String { rawValue }
}

@MainActor
final class A12AppState: ObservableObject {
    @Published var selectedArtifact: ArtifactType = .deck
    @Published var prompt = ArtifactType.deck.prompt
    @Published var activeTab = 0
    @Published var showStudio = false
    @Published var selectedStudioPanel: StudioPanel = .conversation
    @Published var toast: String?
    @Published var generationState = "进行中"
    @Published var generationDetail = "PPT、Word 教案、小游戏方案"
    @Published var messages: [ChatMessage] = [
        ChatMessage(text: "我要做一节 45 分钟的人工智能导论课，面向大一学生。", isUser: true),
        ChatMessage(text: "我会先确认教学目标、重点难点和互动形式。是否希望课程更偏概念入门，还是更偏应用案例？", isUser: false),
        ChatMessage(text: "偏应用案例，最后加一个小游戏。", isUser: true),
        ChatMessage(text: "已整理为课件生成指令集：概念引入、生活案例、核心能力、课堂互动、总结作业。正在融合本地知识库和参考资料。", isUser: false)
    ]
    @Published var outlineItems: [OutlineItem] = [
        OutlineItem(number: "01", title: "什么是人工智能", subtitle: "从校园刷脸、推荐系统切入"),
        OutlineItem(number: "02", title: "AI 如何学习", subtitle: "数据、模型、训练与推理"),
        OutlineItem(number: "03", title: "小组互动", subtitle: "识别生活中的 AI 决策链")
    ]
    @Published var uploadedFiles: [UploadedFile] = []
    private var toastToken = UUID()

    @Published var projects: [ProjectArtifact] = [
        ProjectArtifact(
            title: "AI 导论课项目",
            subtitle: "18 页 PPT · 1 份教案 · 1 个小游戏",
            kind: "进行中",
            systemImage: "rectangle.on.rectangle",
            meta: "45 分钟 · 大一 · 案例教学"
        ),
        ProjectArtifact(
            title: "机器学习入门",
            subtitle: "案例讲解版，已导出 PPT 和 Word 教案。",
            kind: "已完成",
            systemImage: "doc.text",
            meta: "60 分钟 · 研究生 · 案例讲解",
            pageCount: 24
        ),
        ProjectArtifact(
            title: "课堂互动小游戏",
            subtitle: "四人小组活动，适合课堂实时演示。",
            kind: "草稿",
            systemImage: "gamecontroller",
            meta: "20 分钟 · 四人小组 · 实时演示",
            pageCount: 6
        )
    ]

    func select(_ artifact: ArtifactType) {
        selectedArtifact = artifact
        prompt = artifact.prompt
        A12Feedback.selection()
        showToast(artifact.selectionToast)
    }

    func runGeneration() {
        generationState = "进行中"
        generationDetail = "PPT、Word 教案、小游戏方案"
        showStudio = true
        selectedStudioPanel = .conversation
        A12Feedback.tap()
        showToast("已开始生成")
    }

    func applyRevision(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            showToast("请输入修改意见")
            return
        }
        messages.append(ChatMessage(text: text, isUser: true))
        messages.append(ChatMessage(text: "已根据修改意见优化：案例改为校园门禁、学习平台推荐和食堂客流预测；互动小游戏改成 4 人小组协作版本。你可以切到“预览”查看变化，也可以继续提出修改。", isUser: false))
        outlineItems = [
            OutlineItem(number: "01", title: "校园生活中的 AI", subtitle: "门禁识别、学习平台推荐、食堂客流预测"),
            OutlineItem(number: "02", title: "AI 决策链拆解", subtitle: "数据输入、模型判断、行动反馈"),
            OutlineItem(number: "03", title: "4 人小组互动", subtitle: "协作完成校园 AI 场景分析小游戏")
        ]
        selectedStudioPanel = .preview
        generationState = "已完成"
        generationDetail = "已生成新版 PPT、Word 教案、小游戏方案"
        A12Feedback.success()
        showToast("修改已应用到课件预览")
    }

    func addUploadedFiles(_ result: Result<[URL], Error>) {
        guard case .success(let urls) = result, !urls.isEmpty else { return }
        let newFiles = urls.map { url -> UploadedFile in
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 1024
            return UploadedFile(name: url.lastPathComponent, size: size)
        }
        uploadedFiles.append(contentsOf: newFiles)
        showStudio = true
        selectedStudioPanel = .files
        A12Feedback.tap()
        showToast("已添加 \(newFiles.count) 个参考资料")
    }

    func showToast(_ message: String) {
        toast = message
        let token = UUID()
        toastToken = token
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(1.8))
            guard let self, self.toastToken == token else { return }
            self.toast = nil
        }
    }
}
