import Foundation
import SwiftUI

enum ArtifactType: String, CaseIterable, Identifiable {
    case deck = "课件"
    case lessonPlan = "教案"
    case game = "小游戏"
    case knowledge = "知识库"
    case all = "全部"

    var id: String { rawValue }
    var prompt: String {
        switch self {
        case .deck: return "为大一学生生成一节 45 分钟人工智能导论课，自动融合课程资料，输出结构完整、视觉统一的 PPT 课件。"
        case .lessonPlan: return "生成配套 Word 教案，包含课程信息、教学目标、学情分析、流程安排、互动设计、评价方式和课后作业。"
        case .game: return "设计一个适合四人小组参与的课堂小游戏，让学生拆解数据输入、模型判断和行动反馈。"
        case .knowledge: return "上传教材、课程大纲、课堂视频和参考资料，构建本地知识库并为生成内容提供依据。"
        case .all: return "一键生成完整课堂包：PPTX 课件、DOCX 教案、HTML5 互动小游戏和资料解析摘要。"
        }
    }
    var systemImage: String {
        switch self {
        case .deck: return "rectangle.on.rectangle"
        case .lessonPlan: return "doc.text"
        case .game: return "gamecontroller"
        case .knowledge: return "doc.text.magnifyingglass"
        case .all: return "square.grid.2x2"
        }
    }
}

enum AIProvider: String, CaseIterable, Identifiable, Codable {
    case deepSeek = "deepseek"
    case qwen = "qwen"
    case glm = "glm"
    case kimi = "kimi"
    case ernie = "ernie"
    case baichuan = "baichuan"
    case yi = "yi"
    case hunyuan = "hunyuan"

    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .deepSeek: return "DeepSeek"
        case .qwen: return "通义千问"
        case .glm: return "智谱 GLM"
        case .kimi: return "月之暗面 Kimi"
        case .ernie: return "百度文心"
        case .baichuan: return "百川智能"
        case .yi: return "零一万物 Yi"
        case .hunyuan: return "腾讯混元"
        }
    }
    var endpoint: URL {
        switch self {
        case .deepSeek: return URL(string: "https://api.deepseek.com/chat/completions")!
        case .qwen: return URL(string: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions")!
        case .glm: return URL(string: "https://open.bigmodel.cn/api/paas/v4/chat/completions")!
        case .kimi: return URL(string: "https://api.moonshot.cn/v1/chat/completions")!
        case .ernie: return URL(string: "https://qianfan.baidubce.com/v2/chat/completions")!
        case .baichuan: return URL(string: "https://api.baichuan-ai.com/v1/chat/completions")!
        case .yi: return URL(string: "https://api.lingyiwanwu.com/v1/chat/completions")!
        case .hunyuan: return URL(string: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions")!
        }
    }
    var models: [String] {
        switch self {
        case .deepSeek: return ["deepseek-chat", "deepseek-reasoner"]
        case .qwen: return ["qwen-plus", "qwen-max", "qwen-turbo"]
        case .glm: return ["glm-4.5", "glm-4.5-air", "glm-4-flash"]
        case .kimi: return ["kimi-k2-0711-preview", "moonshot-v1-32k", "moonshot-v1-8k"]
        case .ernie: return ["ernie-4.5-turbo-128k", "ernie-4.0-turbo-8k"]
        case .baichuan: return ["Baichuan4", "Baichuan3-Turbo", "Baichuan2-Turbo"]
        case .yi: return ["yi-large", "yi-medium", "yi-lightning"]
        case .hunyuan: return ["hunyuan-turbos-latest", "hunyuan-pro", "hunyuan-standard"]
        }
    }
    var defaultModel: String { models[0] }
}

enum ExportFormat: String, CaseIterable, Identifiable, Codable {
    case pptx = "PPTX"
    case docx = "DOCX"
    case html = "HTML5"
    case markdown = "Markdown"
    var id: String { rawValue }

    var icon: String {
        switch self {
        case .pptx: return "rectangle.on.rectangle.angled"
        case .docx: return "doc.richtext"
        case .html: return "safari"
        case .markdown: return "number"
        }
    }
    var accent: [Color] {
        switch self {
        case .pptx: return [.a12Purple, .a12Blue]
        case .docx: return [.a12Blue, .a12Cyan]
        case .html: return [Color(red: 0.20, green: 0.78, blue: 0.68), .a12Blue]
        case .markdown: return [Color.orange, .a12Purple]
        }
    }
    var description: String {
        switch self {
        case .pptx: return "适合课堂投屏的 12 页视觉化课件，包含标题页、要点页、案例页和互动页。"
        case .docx: return "适合打印与归档的正式教案，包含教学目标、重难点、流程表、评价和作业。"
        case .html: return "可在浏览器打开的互动课堂包，包含卡片、按钮和小组活动说明。"
        case .markdown: return "轻量、可编辑的课程大纲，适合继续交给 AI 或团队协作迭代。"
        }
    }
}

struct ProjectArtifact: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let kind: String
    let systemImage: String
}

struct ChatMessage: Identifiable, Codable {
    let id: UUID
    let text: String
    let isUser: Bool

    init(id: UUID = UUID(), text: String, isUser: Bool) {
        self.id = id
        self.text = text
        self.isUser = isUser
    }
}

/// Persisted conversation, used by the Home screen instead of seeded demo cards.
struct ConversationRecord: Identifiable, Codable {
    let id: UUID
    var title: String
    var messages: [ChatMessage]
    let createdAt: Date
    /// "ppt" / "document" / "conversation". Optional to keep records saved by older builds readable.
    var creationType: String? = nil
    /// Local output location for creations that have a real file, such as a generated PPTX.
    var artifactPath: String? = nil

    var preview: String {
        messages.last(where: { !$0.isUser })?.text ?? messages.last?.text ?? "等待生成回复"
    }
}

struct ImportedFile: Identifiable, Codable {
    let id: UUID
    let name: String
    let fileType: String
    let byteCount: Int
    let summary: String
    let storedPath: String?

    init(id: UUID = UUID(), name: String, fileType: String, byteCount: Int, summary: String, storedPath: String? = nil) {
        self.id = id
        self.name = name
        self.fileType = fileType
        self.byteCount = byteCount
        self.summary = summary
        self.storedPath = storedPath
    }

    var kind: String {
        switch fileType.lowercased() {
        case "markdown", "md": return "MD"
        case "text", "txt": return "TXT"
        case "csv": return "CSV"
        default: return fileType.uppercased()
        }
    }

    var sizeText: String {
        if byteCount >= 1_000_000 { return String(format: "%.1fM", Double(byteCount) / 1_000_000) }
        if byteCount >= 1_000 { return String(format: "%.0fK", Double(byteCount) / 1_000) }
        return "\(byteCount)B"
    }
}

enum KnowledgeCategory: String, CaseIterable, Codable, Identifiable {
    case policy = "政策指南"
    case curriculum = "课程标准"
    case practice = "教学实践"
    case ethics = "伦理安全"
    case resources = "资源平台"

    var id: String { rawValue }
    var icon: String {
        switch self {
        case .policy: return "building.columns"
        case .curriculum: return "book.closed"
        case .practice: return "person.2"
        case .ethics: return "checkmark.shield"
        case .resources: return "square.stack.3d.up"
        }
    }
}

/// A real web source saved in the knowledge base.
struct KnowledgeLink: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var summary: String
    var urlString: String
    var source: String
    var createdAt: Date
    var isSeed: Bool
    var category: KnowledgeCategory
    var extractedContent: String?

    init(id: UUID = UUID(), title: String, summary: String, urlString: String, source: String, createdAt: Date = Date(), isSeed: Bool = false, category: KnowledgeCategory = .resources, extractedContent: String? = nil) {
        self.id = id
        self.title = title
        self.summary = summary
        self.urlString = urlString
        self.source = source
        self.createdAt = createdAt
        self.isSeed = isSeed
        self.category = category
        self.extractedContent = extractedContent
    }

    private enum CodingKeys: String, CodingKey { case id, title, summary, urlString, source, createdAt, isSeed, category, extractedContent }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        title = try values.decodeIfPresent(String.self, forKey: .title) ?? "未命名网页"
        summary = try values.decodeIfPresent(String.self, forKey: .summary) ?? ""
        urlString = try values.decodeIfPresent(String.self, forKey: .urlString) ?? ""
        source = try values.decodeIfPresent(String.self, forKey: .source) ?? "网页来源"
        createdAt = try values.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
        isSeed = try values.decodeIfPresent(Bool.self, forKey: .isSeed) ?? false
        category = try values.decodeIfPresent(KnowledgeCategory.self, forKey: .category) ?? .resources
        extractedContent = try values.decodeIfPresent(String.self, forKey: .extractedContent)
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(id, forKey: .id)
        try values.encode(title, forKey: .title)
        try values.encode(summary, forKey: .summary)
        try values.encode(urlString, forKey: .urlString)
        try values.encode(source, forKey: .source)
        try values.encode(createdAt, forKey: .createdAt)
        try values.encode(isSeed, forKey: .isSeed)
        try values.encode(category, forKey: .category)
        try values.encodeIfPresent(extractedContent, forKey: .extractedContent)
    }

    var url: URL? { URL(string: urlString) }
    var host: String { url?.host ?? urlString }
}

extension KnowledgeLink {
    /// Curated public sources collected for the first launch of TeachNova.
    static let seedResources: [KnowledgeLink] = [
        KnowledgeLink(title: "教育部部署加强中小学人工智能教育", summary: "教育部提出构建系统化课程体系、开发普适化教学资源，并加强教师供给与交流活动。", urlString: "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202412/t20241202_1165500.html", source: "教育部", isSeed: true, category: .policy, extractedContent: "提取要点：\n• 建设系统化人工智能课程体系\n• 开发适合不同学校的教学资源\n• 加强教师队伍供给与校际交流\n• 以课程、资源、师资、活动协同推进普及") ,
        KnowledgeLink(title: "义务教育信息科技课程标准（2022年版）", summary: "课程标准以身边的人工智能场景为案例，帮助学生理解数据、算法、算力及相关安全挑战。", urlString: "https://www.moe.gov.cn/srcsite/A26/s8001/202204/W020220420582361024968.pdf", source: "教育部", isSeed: true, category: .curriculum, extractedContent: "提取要点：\n• 从身边的人工智能应用场景进入课程\n• 引导学生认识数据、算法与算力\n• 在教师帮助下分析 AI 应用的基本特征\n• 同时关注技术应用中的安全与责任") ,
        KnowledgeLink(title: "链接未来：中小学人工智能教育从思考到行动", summary: "围绕精准教学、数字资源共建共享和学生合理使用 AI，分享基础教育实践思路。", urlString: "https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/2025/2025_zt06/pxhy/pxhy_jssy/202505/t20250510_1190078.html", source: "教育部", isSeed: true, category: .practice, extractedContent: "提取要点：\n• 用 AI 支持精准教学与资源共建共享\n• 把合理使用 AI 纳入课堂实践\n• 通过案例、讨论和项目活动培养判断力\n• 关注教师主导和学生主体的协同") ,
        KnowledgeLink(title: "中小学人工智能教育基地名单", summary: "教育部公布中小学人工智能教育基地，作为课程建设、师资培训和资源共建的示范。", urlString: "https://www.moe.gov.cn/srcsite/A06/s3321/202402/t20240223_1116386.html", source: "教育部", isSeed: true, category: .resources, extractedContent: "提取要点：\n• 基地用于课程建设与师资培训\n• 鼓励区域之间共享课程、设备和实践案例\n• 为学校开展人工智能教育提供示范场景") ,
        KnowledgeLink(title: "教师生成式人工智能应用指引（第一版）", summary: "从学习、教学、育人、评价、管理、研究六类场景给出正面示例，并配套行为约束。", urlString: "https://edu.sh.gov.cn/mbjy_xwzx/20251230/3d40abebf1364936b3659ee84be76802.html", source: "上海教育", isSeed: true, category: .practice, extractedContent: "提取要点：\n• 覆盖学习、教学、育人、评价、管理、研究六类场景\n• 提供 30 个正面应用示例\n• 配套 18 项行为约束\n• 使用 AI 时要保护隐私、核验事实并保留教师判断") ,
        KnowledgeLink(title: "AI competency framework for teachers", summary: "UNESCO 提出教师 AI 能力框架，覆盖人本、伦理、基础应用、AI 教学法和专业学习。", urlString: "https://www.unesco.org/en/articles/ai-competency-framework-teachers?hub=83294", source: "UNESCO", isSeed: true, category: .practice, extractedContent: "提取要点：\n• 15 项教师 AI 能力\n• 五个维度：人本、伦理、AI 基础与应用、AI 教学法、专业发展\n• 三个进阶层级：Acquire、Deepen、Create") ,
        KnowledgeLink(title: "AI and education: guidance for policy-makers", summary: "面向政策制定者总结 AI 在教育中的机会与风险，以及包容、公平和以人为本的政策路径。", urlString: "https://www.unesco.org/en/articles/ai-and-education-guidance-policy-makers?hub=32618", source: "UNESCO", isSeed: true, category: .policy, extractedContent: "提取要点：\n• 同时评估 AI 对教育质量、公平和隐私的影响\n• 以人为本、包容和可持续作为政策原则\n• 通过治理、教师能力与基础设施共同推进应用") ,
        KnowledgeLink(title: "Artificial intelligence in education", summary: "UNESCO 汇总人工智能促进教育的机会与风险，强调包容、公平和以人为本。", urlString: "https://www.unesco.org/en/digital-education/artificial-intelligence?hub=195885", source: "UNESCO", isSeed: true, category: .ethics, extractedContent: "提取要点：\n• AI 可支持教学创新并促进教育目标实现\n• 需要同步处理偏见、隐私、数字鸿沟和过度依赖\n• 教育应用应保留人的主体性与批判性思维") ,
        KnowledgeLink(title: "AI competency framework for students", summary: "UNESCO 为学生课程整合提供框架，强调负责任使用、批判判断和 AI 共创。", urlString: "https://www.unesco.org/en/articles/ai-competency-framework-students?hub=66973", source: "UNESCO", isSeed: true, category: .curriculum, extractedContent: "提取要点：\n• 12 项学生 AI 能力，分为四个维度\n• 人本思维、AI 伦理、技术与应用、AI 系统设计\n• 三个进阶层级：理解、应用、创造\n• 目标是培养负责任的 AI 使用者和共创者") ,
        KnowledgeLink(title: "中小学人工智能通识教育指南（2025年版）", summary: "面向全体中小学生普及 AI 基本概念、技术原理、应用场景、伦理安全和社会影响。", urlString: "https://www.cse.edu.cn/index/detail.html?category=31&id=4240", source: "中国教育学会", isSeed: true, category: .curriculum, extractedContent: "提取要点：\n• 面向全体中小学生开展系统化课程、活动和实践\n• 内容覆盖基本概念、技术原理、应用场景、伦理安全和社会影响\n• 坚持立德树人、主动引领、公平普惠、多方参与") ,
        KnowledgeLink(title: "中小学生成式人工智能使用指南（2025年版）", summary: "强调因地制宜、分类施策和数据安全，给出学校使用生成式 AI 的管理边界。", urlString: "https://jyj.linxia.gov.cn/jyj/xxgk/fdzdgknr/zcwj/GJZC/art/2025/art_ec21649bfa774fb28ca73d6c6e287e4c.html", source: "教育部基础教育教学指导委员会", isSeed: true, category: .ethics, extractedContent: "提取要点：\n• 学校应建立生成式 AI 进校准入和动态评估机制\n• 可用 OCR 将纸质资料数字化，再做信息提取\n• 避免一刀切和过度依赖，加强数据安全与隐私保护\n• 依据年龄和场景制定差异化、递进式策略") ,
        KnowledgeLink(title: "北京市推进中小学人工智能教育工作方案（2025—2027年）", summary: "以课程体系和典型场景为切入，建设地方课程纲要、教学指南和动态课程资源。", urlString: "https://www.beijing.gov.cn/zhengce/gfxwj/sj/202503/t20250310_4029667.html", source: "北京市教育委员会", isSeed: true, category: .policy, extractedContent: "提取要点：\n• 探索设置中小学人工智能地方课程\n• 针对不同学段编制教学指南和学生手册\n• 开发动态更新的配套课程资源\n• 以课程、场景和资源建设形成区域教育体系") ,
        KnowledgeLink(title: "‘人工智能+教育’行动计划", summary: "提出推动智能技术与教育全要素融合，普及中小学 AI 教育并建立安全审核机制。", urlString: "https://www.moe.gov.cn/srcsite/A16/s3342/202604/t20260410_1433240.html", source: "教育部等五部门", isSeed: true, category: .policy, extractedContent: "提取要点：\n• 推动智能技术全要素、全过程、全场景融入教育\n• 普及中小学人工智能课程，鼓励跨学科教学\n• 推动人工智能成为高校公共基础课\n• 建立教育大模型安全审核机制") ,
        KnowledgeLink(title: "国家中小学智慧教育平台与人工智能融合应用指南（试行）", summary: "围绕国家智慧教育平台资源与 AI 协同应用，提供教学流程融合方向。", urlString: "https://edu.foshan.gov.cn/attachment/0/534/534609/6554307.pdf", source: "教育行政部门公开资料", isSeed: true, category: .resources, extractedContent: "提取要点：\n• 将平台课程资源与人工智能工具协同使用\n• 支持备课、课堂活动、作业反馈等环节\n• 强调 AI 是教师的协作伙伴，不能替代教育判断") ,
        KnowledgeLink(title: "北京市学校教育应用人工智能指导规范", summary: "公开指南涵盖学校使用 AI 的基本原则、应用场景指引和规范要求。", urlString: "https://jw.beijing.gov.cn/xxgk/2024zcwj/2024qtwj/202410/W020241028527811757298.pdf", source: "北京市教育委员会", isSeed: true, category: .ethics, extractedContent: nil)
    ]
}

enum TeamRole: String, CaseIterable, Identifiable, Codable {
    case admin = "管理员"
    case editor = "编辑者"
    case viewer = "只读成员"
    var id: String { rawValue }
}

struct TeamMember: Identifiable, Codable {
    let id: UUID
    var name: String
    var email: String
    var role: TeamRole
    var canOperate: Bool
    init(id: UUID = UUID(), name: String, email: String, role: TeamRole = .editor, canOperate: Bool = true) {
        self.id = id; self.name = name; self.email = email; self.role = role; self.canOperate = canOperate
    }

    private enum CodingKeys: String, CodingKey { case id, name, email, role, canOperate }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        name = try values.decodeIfPresent(String.self, forKey: .name) ?? "未命名成员"
        email = try values.decodeIfPresent(String.self, forKey: .email) ?? ""
        let roleValue = try values.decodeIfPresent(String.self, forKey: .role) ?? TeamRole.editor.rawValue
        role = TeamRole(rawValue: roleValue) ?? (roleValue == "管理员" ? .admin : .editor)
        canOperate = try values.decodeIfPresent(Bool.self, forKey: .canOperate) ?? (role != .viewer)
    }
}

@MainActor
final class A12AppState: ObservableObject {
    @Published var selectedArtifact: ArtifactType = .deck
    @Published var prompt = ""
    @Published var activeTab = 0
    @Published var showStudio = false
    @Published var showDocumentOptimizer = false
    @Published var showPPTGenerator = false
    @Published var showInteractiveClassroom = false
    @Published var showRecentCreations = false
    @Published var selectedStudioPanel = "对话"
    @Published var conversationID = UUID()
    @Published var toast: String?
    @Published var generationState = "智能体就绪"
    @Published var thinkingSteps = ["正在理解备课要求", "正在检索知识库资料", "正在组织课堂结构", "正在整理回答"]
    @Published var activeThinkingStep = -1
    @Published var isStreamingReply = false
    @Published var streamingReply = ""

    @Published var selectedProvider: AIProvider = .deepSeek
    @Published var selectedModel = AIProvider.deepSeek.defaultModel
    @Published var apiKey = ""
    @Published var connectionState = "未配置"
    @Published var connectionHint: String?

    @Published var exportFormat: ExportFormat = .pptx
    @Published var includeSources = true
    @Published var autoSaveExports = true
    @Published var lastExportURL: URL?

    @Published var importedFiles: [ImportedFile] = []
    @Published var knowledgeLinks: [KnowledgeLink] = []
    @Published var recentConversations: [ConversationRecord] = []

    @Published var teamName = "TeachNova 教学创新组"
    @Published var teamMembers: [TeamMember] = [TeamMember(name: "我", email: "本地账户", role: .admin, canOperate: true)]
    @Published var messages: [ChatMessage] = []
    let artifacts = [
        ProjectArtifact(title: "AI 导论课件", subtitle: "12 页视觉版 PPTX", kind: "PPTX", systemImage: "rectangle.on.rectangle"),
        ProjectArtifact(title: "教学设计文档", subtitle: "完整 Word 教案", kind: "DOCX", systemImage: "doc.text"),
        ProjectArtifact(title: "互动课堂包", subtitle: "含 HTML5 小游戏", kind: "HTML5", systemImage: "sparkles")
    ]

    init() {
        let defaults = UserDefaults.standard
        if let raw = defaults.string(forKey: "teachnova.provider"), let provider = AIProvider(rawValue: raw) {
            selectedProvider = provider
            selectedModel = defaults.string(forKey: "teachnova.model") ?? provider.defaultModel
        }
        apiKey = KeychainStore.load(key: "teachnova.apiKey.\(selectedProvider.rawValue)") ?? KeychainStore.load(key: "teachnova.apiKey") ?? ""
        connectionState = apiKey.isEmpty ? "未配置" : "已保存"
        if let raw = defaults.string(forKey: "teachnova.exportFormat"), let format = ExportFormat(rawValue: raw) { exportFormat = format }
        includeSources = defaults.object(forKey: "teachnova.includeSources") as? Bool ?? true
        autoSaveExports = defaults.object(forKey: "teachnova.autoSave") as? Bool ?? true
        if let data = defaults.data(forKey: "teachnova.teamMembers"), let members = try? JSONDecoder().decode([TeamMember].self, from: data) { teamMembers = members }
        teamName = defaults.string(forKey: "teachnova.teamName") ?? teamName
        if let data = defaults.data(forKey: "teachnova.importedFiles"), let files = try? JSONDecoder().decode([ImportedFile].self, from: data) { importedFiles = files }
        if let data = defaults.data(forKey: "teachnova.knowledgeLinks"), let links = try? JSONDecoder().decode([KnowledgeLink].self, from: data) {
            knowledgeLinks = links
        } else {
            knowledgeLinks = KnowledgeLink.seedResources
        }
        if let data = defaults.data(forKey: "teachnova.recentConversations"),
           let conversations = try? JSONDecoder().decode([ConversationRecord].self, from: data) {
            recentConversations = conversations
        }
        // Add newly curated sources once while preserving links the user already saved.
        let seedVersion = 2
        if defaults.integer(forKey: "teachnova.knowledgeSeedVersion") < seedVersion {
            var merged = knowledgeLinks
            for seed in KnowledgeLink.seedResources {
                if let index = merged.firstIndex(where: { $0.urlString.caseInsensitiveCompare(seed.urlString) == .orderedSame }) {
                    if merged[index].isSeed { merged[index] = seed }
                } else {
                    merged.append(seed)
                }
            }
            knowledgeLinks = merged
            defaults.set(seedVersion, forKey: "teachnova.knowledgeSeedVersion")
            persistKnowledgeLinks()
        }
    }

    func select(_ artifact: ArtifactType) {
        withAnimation(.a12Smooth) {
            selectedArtifact = artifact; generationState = artifact == .all ? "准备导出" : "智能体就绪"
            if artifact == .knowledge { activeTab = 2 }
            if artifact == .all { showStudio = true; selectedStudioPanel = "预览" }
        }
        showToast("已切换到\(artifact.rawValue)")
    }

    func saveAISettings() {
        let defaults = UserDefaults.standard
        defaults.set(selectedProvider.rawValue, forKey: "teachnova.provider")
        defaults.set(selectedModel, forKey: "teachnova.model")
        if apiKey.isEmpty { KeychainStore.delete(key: "teachnova.apiKey.\(selectedProvider.rawValue)"); connectionState = "未配置" }
        else { KeychainStore.save(apiKey, key: "teachnova.apiKey.\(selectedProvider.rawValue)"); connectionState = "已保存" }
        connectionHint = "请点击连接测试完成连接大模型 qwq"
    }

    func providerChanged(_ provider: AIProvider) {
        selectedProvider = provider
        selectedModel = provider.defaultModel
        apiKey = KeychainStore.load(key: "teachnova.apiKey.\(provider.rawValue)") ?? ""
        connectionState = apiKey.isEmpty ? "未配置" : "已保存"
        connectionHint = nil
    }

    func testConnection() async {
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            connectionState = "未配置"
            connectionHint = "连接失败，请重新输入后保存"
            return
        }
        connectionState = "连接中…"
        do {
            _ = try await DomesticAIClient(provider: selectedProvider, model: selectedModel, apiKey: apiKey).send(messages: ["你好，请只回复：连接成功"], system: "你是 TeachNova 连接测试助手。")
            connectionState = "已连接"
            connectionHint = nil
            showToast("\(selectedProvider.displayName) 连接成功")
        } catch {
            connectionState = "连接失败"
            connectionHint = "连接失败，请重新输入后保存"
        }
    }

    func startFreshConversation() {
        withAnimation(.a12Smooth) {
            conversationID = UUID()
            messages = []
            prompt = ""
            streamingReply = ""
            isStreamingReply = false
            generationState = "新对话已就绪"
            activeThinkingStep = -1
            selectedStudioPanel = "对话"
            showStudio = true
        }
    }

    func runGeneration() {
        let request = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !request.isEmpty else { showToast("请先输入备课需求"); return }
        guard isDetailedEnough(request) else {
            startClarifyingConversation(request)
            return
        }
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { showToast("请先在“我的 > 模型与智能体”填写 API Key"); activeTab = 3; return }

        let newConversationID = UUID()
        withAnimation(.a12Smooth) {
            messages = [ChatMessage(text: request, isUser: true)]
            conversationID = newConversationID
            generationState = "生成中…"
            prompt = ""
            beginThinking()
            showStudio = true
            selectedStudioPanel = "对话"
        }
        Task { await generateWithAI(request: request, conversationID: newConversationID) }
    }

    private func generateWithAI(request: String, conversationID: UUID) async {
        do {
            try? await Task.sleep(nanoseconds: 280_000_000)
            guard self.conversationID == conversationID else { return }
            activeThinkingStep = 1
            let localContext = importedFiles.map { "\($0.name)：\($0.summary)" }.joined(separator: "\n")
            let webContext = relevantKnowledgeLinks(for: request).map { "[\($0.category.rawValue)] \($0.title)（\($0.source)）：\($0.summary)\n\($0.extractedContent ?? "仅保留原网页链接")\n链接：\($0.urlString)" }.joined(separator: "\n")
            let sourceContext = [localContext, webContext].filter { !$0.isEmpty }.joined(separator: "\n")
            let requestPrompt = sourceContext.isEmpty ? request : "\(request)\n\n与本次需求匹配的参考资料：\n\(sourceContext)"
            activeThinkingStep = 2
            let result = try await DomesticAIClient(provider: selectedProvider, model: selectedModel, apiKey: apiKey).send(messages: [requestPrompt], system: teachingSystemPrompt)
            guard self.conversationID == conversationID else { return }
            activeThinkingStep = 3
            await typewriteResponse(result, conversationID: conversationID)
        } catch {
            guard self.conversationID == conversationID else { return }
            withAnimation(.a12Gentle) { generationState = "生成失败"; activeThinkingStep = -1 }
            showToast("生成失败：\(error.localizedDescription)")
        }
    }

    func applyRevision(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { showToast("请输入修改意见"); return }
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { showToast("请先在“我的 > 模型与智能体”填写 API Key"); return }
        let activeConversationID = conversationID
        withAnimation(.a12Smooth) {
            messages.append(ChatMessage(text: text, isUser: true))
            generationState = "正在优化…"
            beginThinking()
            selectedStudioPanel = "对话"
        }
        Task { await generateRevision(text, conversationID: activeConversationID) }
    }

    private func generateRevision(_ revision: String, conversationID: UUID) async {
        do {
            try? await Task.sleep(nanoseconds: 280_000_000)
            guard self.conversationID == conversationID else { return }
            activeThinkingStep = 1
            let history = messages.map { message in
                "\(message.isUser ? "用户" : "助手")：\(message.text)"
            }.joined(separator: "\n")
            activeThinkingStep = 2
            let response = try await DomesticAIClient(provider: selectedProvider, model: selectedModel, apiKey: apiKey).send(
                messages: ["当前对话：\n\(history)\n\n本次修改要求：\(revision)"],
                system: "你是 TeachNova 教学设计助手。根据用户最新修改要求，给出可直接替换到课件或教案中的具体内容。"
            )
            guard self.conversationID == conversationID else { return }
            activeThinkingStep = 3
            await typewriteResponse(response, conversationID: conversationID)
        } catch {
            guard self.conversationID == conversationID else { return }
            generationState = "优化失败"
            activeThinkingStep = -1
            showToast("优化失败：\(error.localizedDescription)")
        }
    }

    private func beginThinking() {
        activeThinkingStep = 0
        streamingReply = ""
        isStreamingReply = false
    }

    private func typewriteResponse(_ response: String, conversationID: UUID) async {
        guard !response.isEmpty else { return }
        generationState = "正在逐字输出…"
        isStreamingReply = true
        streamingReply = ""

        // The provider response is fully received first. Buffer several natural
        // chunks before rendering, then reveal them at a steady cadence.
        let chunks = streamingChunks(for: response)
        guard !chunks.isEmpty else { return }
        let bufferedCount = min(4, chunks.count)
        try? await Task.sleep(nanoseconds: 180_000_000)
        var index = 0
        while index < chunks.count {
            guard self.conversationID == conversationID else { return }
            let batchSize = index < bufferedCount ? 1 : min(2, chunks.count - index)
            for offset in 0..<batchSize { streamingReply += chunks[index + offset] }
            index += batchSize
            try? await Task.sleep(nanoseconds: UInt64(index < bufferedCount ? 26_000_000 : 44_000_000))
        }

        guard self.conversationID == conversationID else { return }
        messages.append(ChatMessage(text: response, isUser: false))
        streamingReply = ""
        isStreamingReply = false
        generationState = "已完成"
        activeThinkingStep = thinkingSteps.count
        saveCurrentConversation(conversationID: conversationID)
        showToast("\(selectedProvider.displayName) 已完成生成")
    }

    private func streamingChunks(for response: String) -> [String] {
        let punctuation = CharacterSet(charactersIn: "。！？；，\n")
        var chunks: [String] = []
        var current = ""
        for character in response {
            current.append(character)
            if current.count >= 12 || String(character).rangeOfCharacter(from: punctuation) != nil {
                chunks.append(current)
                current = ""
            }
        }
        if !current.isEmpty { chunks.append(current) }
        return chunks
    }

    private func saveCurrentConversation(conversationID: UUID) {
        guard !messages.isEmpty else { return }
        let firstRequest = messages.first(where: { $0.isUser })?.text ?? "未命名对话"
        let compact = firstRequest.replacingOccurrences(of: "\n", with: " ")
        let title = compact.count > 18 ? String(compact.prefix(18)) + "…" : compact
        let record = ConversationRecord(id: conversationID, title: title, messages: messages, createdAt: Date(), creationType: "conversation")
        storeCreation(record)
    }

    func saveCreation(title: String, request: String, summary: String, creationType: String? = nil, artifactPath: String? = nil) {
        let record = ConversationRecord(
            id: UUID(),
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            messages: [
                ChatMessage(text: request.trimmingCharacters(in: .whitespacesAndNewlines), isUser: true),
                ChatMessage(text: String(summary.prefix(8_000)), isUser: false)
            ],
            createdAt: Date(),
            creationType: creationType,
            artifactPath: artifactPath
        )
        storeCreation(record)
    }

    private func storeCreation(_ record: ConversationRecord) {
        recentConversations.removeAll { $0.id == record.id }
        recentConversations.insert(record, at: 0)
        recentConversations = Array(recentConversations.prefix(20))
        persistRecentConversations()
    }

    private func isDetailedEnough(_ request: String) -> Bool {
        let compact = request.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "\n", with: "")
        return compact.count >= 6
    }

    private func startClarifyingConversation(_ request: String) {
        let newConversationID = UUID()
        withAnimation(.a12Smooth) {
            conversationID = newConversationID
            messages = [
                ChatMessage(text: request, isUser: true),
                ChatMessage(text: "我还无法据此生成内容。请补充至少两项信息：课程主题、学生群体、时长、想要的产物或教学重点。例如：为大一学生设计一节 45 分钟的人工智能导论课。", isUser: false)
            ]
            prompt = ""
            generationState = "等待补充需求"
            activeThinkingStep = -1
            showStudio = true
            selectedStudioPanel = "对话"
        }
    }

    private func relevantKnowledgeLinks(for request: String) -> [KnowledgeLink] {
        let query = request.lowercased()
        let terms = ["人工智能", "ai", "教育", "课程", "教学", "教案", "课堂", "信息科技", "伦理", "隐私", "小学", "中学", "大学"]
            .filter { query.contains($0) }
        guard !terms.isEmpty else { return [] }
        return knowledgeLinks.filter { link in
            let content = "\(link.title) \(link.summary) \(link.category.rawValue)".lowercased()
            return terms.contains { content.contains($0) }
        }
        .prefix(6)
        .map { $0 }
    }

    private var teachingSystemPrompt: String {
        """
        你是 TeachNova 的教学设计助手。只处理用户明确提出的备课需求。
        
        工作规则：
        1. 不要从单个字母、无主题片段或知识库标题推断完整课程。若关键信息不足，只提出不超过 3 个简洁的补充问题，不生成课程正文。
        2. 不要把未匹配的知识库资料、政策、课程标准或案例写入答案；仅能使用本轮消息中提供的匹配资料。
        3. 不要编造教育政策、来源、数字、学生年级、时长或课堂条件。用户没说的内容要明确询问，或用“待确认”标记。
        4. 信息充分时，先用一句话复述已确认的需求，再给出与需求直接相关的教学结构、互动设计和下一步建议。文字简洁、可执行。
        5. 使用普通中文排版：不要输出 Markdown 标记、代码块、表格竖线、井号标题或星号加粗。需要分段时直接用自然语言标题、编号和换行。
        """
    }

    func openConversation(_ record: ConversationRecord) {
        withAnimation(.a12Smooth) {
            conversationID = record.id
            messages = record.messages
            selectedStudioPanel = "对话"
            generationState = "已完成"
            showStudio = true
        }
    }

    func saveExportSettings() {
        let defaults = UserDefaults.standard
        defaults.set(exportFormat.rawValue, forKey: "teachnova.exportFormat"); defaults.set(includeSources, forKey: "teachnova.includeSources"); defaults.set(autoSaveExports, forKey: "teachnova.autoSave")
        showToast("导出设置已保存")
    }

    func exportArtifact(title: String = "TeachNova 教学内容") {
        do { lastExportURL = try ExportService.makeFile(title: title, format: exportFormat, includeSources: includeSources); showToast("已生成 \(exportFormat.rawValue) 文件") }
        catch { showToast("导出失败：\(error.localizedDescription)") }
    }

    func importFiles(_ urls: [URL]) {
        let supported = Set(["pdf", "docx", "pptx", "txt", "md", "csv"])
        let fileManager = FileManager.default
        let directory = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TeachNova/ImportedFiles", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        var importedCount = 0
        var skippedCount = 0

        for url in urls {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            let ext = url.pathExtension.lowercased()
            guard supported.contains(ext) else { skippedCount += 1; continue }
            let byteCount = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard byteCount <= 25_000_000 else { skippedCount += 1; continue }

            let id = UUID()
            let destination = directory.appendingPathComponent("\(id.uuidString)-\(url.lastPathComponent)")
            try? fileManager.removeItem(at: destination)
            try? fileManager.copyItem(at: url, to: destination)
            let summary: String
            if ["txt", "md", "csv"].contains(ext), let text = try? String(contentsOf: url, encoding: .utf8) {
                let clean = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
                summary = clean.isEmpty ? "文本文件已导入，内容为空" : "已读取文本：\(clean.prefix(90))"
            } else {
                summary = "已导入 \(ext.uppercased())，可继续进行资料解析"
            }
            importedFiles.insert(ImportedFile(name: url.lastPathComponent, fileType: ext, byteCount: byteCount, summary: summary, storedPath: destination.path), at: 0)
            importedCount += 1
        }

        persistImportedFiles()
        if importedCount > 0 {
            showToast("已导入 \(importedCount) 个资料\(skippedCount > 0 ? "，跳过 \(skippedCount) 个" : "")")
        } else if skippedCount > 0 {
            showToast("未导入资料：支持 PDF、DOCX、PPTX、TXT、MD、CSV，且不超过 25MB")
        }
    }

    func removeImportedFile(_ file: ImportedFile) {
        if let storedPath = file.storedPath { try? FileManager.default.removeItem(atPath: storedPath) }
        importedFiles.removeAll { $0.id == file.id }
        persistImportedFiles()
        showToast("已移除 \(file.name)")
    }

    @discardableResult
    func saveKnowledgeLink(title: String, summary: String, urlString: String) -> Bool {
        let cleanURL = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: cleanURL),
              let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme),
              url.host != nil else {
            showToast("请输入有效的 http(s) 网页链接")
            return false
        }

        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanSummary = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        let item = KnowledgeLink(
            title: cleanTitle.isEmpty ? (url.host ?? "未命名网页") : cleanTitle,
            summary: cleanSummary.isEmpty ? "已保存网页来源，可点击查看原文。" : cleanSummary,
            urlString: cleanURL,
            source: url.host ?? "网页来源"
        )
        if let index = knowledgeLinks.firstIndex(where: { $0.urlString.caseInsensitiveCompare(cleanURL) == .orderedSame }) {
            knowledgeLinks[index] = item
            showToast("已更新知识库链接")
        } else {
            knowledgeLinks.insert(item, at: 0)
            showToast("已保存到知识库")
        }
        persistKnowledgeLinks()
        return true
    }

    func removeKnowledgeLink(_ link: KnowledgeLink) {
        knowledgeLinks.removeAll { $0.id == link.id }
        persistKnowledgeLinks()
        showToast("已移除 \(link.title)")
    }

    func addTeamMember(name: String, email: String, role: TeamRole, canOperate: Bool) {
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines); let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty, !cleanEmail.isEmpty else { showToast("请填写姓名和邮箱"); return }
        teamMembers.append(TeamMember(name: cleanName, email: cleanEmail, role: role, canOperate: canOperate)); persistTeam(); showToast("已添加团队成员")
    }
    func removeTeamMember(_ member: TeamMember) {
        guard member.role != .admin else { showToast("管理员不能移除"); return }
        teamMembers.removeAll { $0.id == member.id }; persistTeam(); showToast("已移除团队成员")
    }
    func saveTeamName() { UserDefaults.standard.set(teamName, forKey: "teachnova.teamName"); persistTeam(); showToast("团队空间已保存") }
    private func persistTeam() {
        if let data = try? JSONEncoder().encode(teamMembers) { UserDefaults.standard.set(data, forKey: "teachnova.teamMembers") }
        UserDefaults.standard.set(teamName, forKey: "teachnova.teamName")
    }
    private func persistImportedFiles() {
        if let data = try? JSONEncoder().encode(importedFiles) { UserDefaults.standard.set(data, forKey: "teachnova.importedFiles") }
    }
    private func persistKnowledgeLinks() {
        if let data = try? JSONEncoder().encode(knowledgeLinks) { UserDefaults.standard.set(data, forKey: "teachnova.knowledgeLinks") }
    }
    private func persistRecentConversations() {
        if let data = try? JSONEncoder().encode(recentConversations) {
            UserDefaults.standard.set(data, forKey: "teachnova.recentConversations")
        }
    }
    func showToast(_ message: String) {
        withAnimation(.a12Smooth) { toast = message }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { if self.toast == message { withAnimation(.a12Gentle) { self.toast = nil } } }
    }
}
