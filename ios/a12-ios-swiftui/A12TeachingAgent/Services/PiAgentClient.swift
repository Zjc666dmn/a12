import Foundation
import Security

/// OpenAI-compatible clients for the domestic providers configured in TeachNova.
struct DomesticAIClient {
    let provider: AIProvider
    let model: String
    let apiKey: String

    func send(messages: [String], system: String) async throws -> String {
        struct ChatMessage: Encodable { let role: String; let content: String }
        struct RequestBody: Encodable { let model: String; let messages: [ChatMessage]; let temperature: Double }
        struct ResponseBody: Decodable {
            struct Choice: Decodable { struct Message: Decodable { let content: String }; let message: Message }
            let choices: [Choice]?
            let error: APIError?
        }
        struct APIError: Decodable { let message: String?; let code: String? }

        var request = URLRequest(url: provider.endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 45
        let allMessages = [ChatMessage(role: "system", content: system)] + messages.map { ChatMessage(role: "user", content: $0) }
        request.httpBody = try JSONEncoder().encode(RequestBody(model: model, messages: allMessages, temperature: 0.4))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw ClientError.invalidResponse }
        let decoded = try? JSONDecoder().decode(ResponseBody.self, from: data)
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw ClientError.server(decoded?.error?.message ?? "HTTP \(httpResponse.statusCode)")
        }
        guard let content = decoded?.choices?.first?.message.content, !content.isEmpty else { throw ClientError.emptyResponse }
        return content
    }

    enum ClientError: LocalizedError {
        case invalidResponse
        case emptyResponse
        case server(String)
        var errorDescription: String? {
            switch self {
            case .invalidResponse: return "服务响应无效"
            case .emptyResponse: return "模型返回为空"
            case .server(let message): return message
            }
        }
    }
}

enum KeychainStore {
    private static let service = "com.teachnova.api-keys"
    private static let localFallbackKey = "teachnova.localApiKeys"

    static func save(_ value: String, key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = Data(value.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)

        // Some simulator images intermittently reject Keychain writes. Keep a local
        // app-only fallback as well so a saved key survives a normal relaunch.
        var values = UserDefaults.standard.dictionary(forKey: localFallbackKey) as? [String: String] ?? [:]
        values[key] = value
        UserDefaults.standard.set(values, forKey: localFallbackKey)
    }

    static func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let value = String(data: data, encoding: .utf8) {
            return value
        }
        return (UserDefaults.standard.dictionary(forKey: localFallbackKey) as? [String: String])?[key]
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var values = UserDefaults.standard.dictionary(forKey: localFallbackKey) as? [String: String] ?? [:]
        values.removeValue(forKey: key)
        UserDefaults.standard.set(values, forKey: localFallbackKey)
    }
}

enum ExportService {
    static func makeFile(title: String, format: ExportFormat, includeSources: Bool) throws -> URL {
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let ext = format == .html ? "html" : format == .markdown ? "md" : "txt"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("TeachNova-\(stamp).\(ext)")
        let sourceLine = includeSources ? "\n\n资料来源：TeachNova 知识库（网页来源与本地资料）" : ""
        let body: String
        switch format {
        case .html:
            body = """
            <!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>\(title)</title>
            <style>body{font:18px -apple-system;padding:40px;color:#071f45}h1{color:#157aff}</style>
            <h1>\(title)</h1><p>由 TeachNova 生成的课堂内容预览。</p><p>请在工作台中继续完善课程结构与互动设计。</p>\(sourceLine.replacingOccurrences(of: "\n", with: "<br>"))
            """
        case .pptx:
            body = """
            TeachNova · PPTX 课件内容预览
            ============================
            标题页：人工智能导论
            第 1 页：生活中的 AI 场景
            第 2 页：数据输入 → 模型判断 → 行动反馈
            第 3 页：校园门禁、学习推荐、食堂客流预测
            第 4 页：4 人小组课堂互动
            视觉建议：蓝紫渐变、卡片式要点、每页不超过 3 个核心结论
            \(sourceLine)
            """
        case .docx:
            body = """
            TeachNova · DOCX 教案内容预览
            ============================
            一、课程信息：人工智能导论｜大一｜45 分钟
            二、教学目标：理解 AI 决策链并能分析校园案例
            三、教学重点与难点：数据、模型、反馈之间的关系
            四、教学流程：概念引入（5 分钟）→ 案例讲解（20 分钟）→ 小组活动（15 分钟）→ 总结（5 分钟）
            五、评价方式：小组展示 + 课堂提问 + 课后作业
            \(sourceLine)
            """
        case .markdown:
            body = """
            # \(title)

            ## 学习目标
            - [ ] 说出 AI 决策链的三个环节
            - [ ] 分析一个校园生活案例
            - [ ] 与小组成员完成课堂小游戏

            ## 课堂流程
            1. 概念引入（5 分钟）
            2. 案例拆解（20 分钟）
            3. 四人协作（15 分钟）
            4. 总结作业（5 分钟）
            \(sourceLine)
            """
        }
        try body.data(using: .utf8)!.write(to: url, options: .atomic)
        return url
    }
}

// MARK: - Real PPTX generation

struct PPTDeck: Codable {
    var title: String
    var subtitle: String
    var slides: [PPTDeckSlide]

    static func fromModelOutput(_ output: String, fallbackPrompt: String) -> PPTDeck {
        let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidates = [trimmed, jsonFragment(in: trimmed)].compactMap { $0 }
        for candidate in candidates {
            guard let data = candidate.data(using: .utf8),
                  let deck = try? JSONDecoder().decode(PPTDeck.self, from: data),
                  !deck.title.isEmpty,
                  !deck.slides.isEmpty else { continue }
            return PPTDeck(title: deck.title, subtitle: deck.subtitle, slides: Array(deck.slides.prefix(12)))
        }

        let compact = fallbackPrompt.replacingOccurrences(of: "\n", with: " ")
        let title = compact.count > 22 ? String(compact.prefix(22)) + "…" : compact
        return PPTDeck(
            title: title.isEmpty ? "TeachNova 教学课件" : title,
            subtitle: "由 TeachNova 生成的课堂课件",
            slides: [
                PPTDeckSlide(title: "课程目标", bullets: ["明确本节课的学习目标", "从真实课堂情境进入主题"]),
                PPTDeckSlide(title: "核心概念", bullets: ["解释关键概念与必要背景", "用一个具体案例帮助理解"]),
                PPTDeckSlide(title: "课堂案例", bullets: ["分析案例中的问题与选择", "引导学生给出自己的判断"]),
                PPTDeckSlide(title: "小组活动", bullets: ["四人分工完成任务", "记录理由并准备分享"]),
                PPTDeckSlide(title: "总结与作业", bullets: ["回顾本节课的关键结论", "布置可继续探究的任务"])
            ]
        )
    }

    private static func jsonFragment(in text: String) -> String? {
        guard let start = text.firstIndex(of: "{"), let end = text.lastIndex(of: "}"), start <= end else { return nil }
        return String(text[start...end])
    }
}

struct PPTDeckSlide: Codable, Identifiable {
    let id: UUID
    var title: String
    var bullets: [String]

    init(id: UUID = UUID(), title: String, bullets: [String]) {
        self.id = id
        self.title = title
        self.bullets = bullets
    }

    private enum CodingKeys: String, CodingKey { case title, bullets }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = UUID()
        title = try values.decode(String.self, forKey: .title)
        bullets = try values.decode([String].self, forKey: .bullets)
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(title, forKey: .title)
        try values.encode(bullets, forKey: .bullets)
    }
}

enum PPTPlanService {
    static func create(prompt: String, provider: AIProvider, model: String, apiKey: String) async throws -> PPTDeck {
        let system = """
        你是 TeachNova 的 PPT 教学设计师。根据用户需求生成一份中文教学 PPT 大纲。
        只输出合法 JSON，不要 Markdown，不要代码块。格式如下：
        {"title":"课件标题","subtitle":"适用对象与时长","slides":[{"title":"页面标题","bullets":["要点一","要点二"]}]}
        生成 5 到 8 页内容页。每页 2 到 4 条简洁、可教学的要点。
        只使用用户明确给出的主题、受众、时长和约束；缺失的信息写“待确认”，绝不从常识补造具体年级、课程内容、政策、来源或数据。
        """
        let result = try await DomesticAIClient(provider: provider, model: model, apiKey: apiKey)
            .send(messages: [prompt], system: system)
        return PPTDeck.fromModelOutput(result, fallbackPrompt: prompt)
    }

    static func revise(deck: PPTDeck, direction: String, provider: AIProvider, model: String, apiKey: String) async throws -> PPTDeck {
        let currentOutline = String(data: try JSONEncoder().encode(deck), encoding: .utf8) ?? "{}"
        let system = """
        你是 TeachNova 的 PPT 教学设计师。根据用户的修改方向改写已有 PPT 大纲。
        只输出合法 JSON，不要 Markdown，不要代码块。格式如下：
        {"title":"课件标题","subtitle":"适用对象与时长","slides":[{"title":"页面标题","bullets":["要点一","要点二"]}]}
        保留用户未要求变更的主题、受众和页面数量；只改用户明确提出的内容。每页保留 2 到 4 条简洁、可教学的要点，不要编造数据、政策、来源或事实。
        """
        let prompt = "当前 PPT 大纲：\n\(currentOutline)\n\n修改方向：\(direction)"
        let result = try await DomesticAIClient(provider: provider, model: model, apiKey: apiKey)
            .send(messages: [prompt], system: system)
        return PPTDeck.fromModelOutput(result, fallbackPrompt: deck.title)
    }
}

enum PPTXService {
    static func export(deck: PPTDeck, endpointText: String) async throws -> URL {
        guard let endpoint = URL(string: endpointText.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = endpoint.scheme?.lowercased(), ["http", "https"].contains(scheme) else {
            throw ServiceError.invalidEndpoint
        }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/vnd.openxmlformats-officedocument.presentationml.presentation", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(deck)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ServiceError.unavailable
        }
        guard data.count > 1_000, data.starts(with: [0x50, 0x4B]) else { throw ServiceError.invalidPPTX }

        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TeachNova/CreatedFiles", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent("TeachNova-\(stamp).pptx")
        try data.write(to: url, options: .atomic)
        return url
    }

    enum ServiceError: LocalizedError {
        case invalidEndpoint
        case unavailable
        case invalidPPTX

        var errorDescription: String? {
            switch self {
            case .invalidEndpoint: return "PPTX 服务地址无效"
            case .unavailable: return "PPTX 服务不可用，请启动项目内的 tools/pptx-service"
            case .invalidPPTX: return "服务返回的不是有效 PPTX 文件"
            }
        }
    }
}

enum DocumentOptimizerService {
    static func optimize(text: String, direction: String, provider: AIProvider, model: String, apiKey: String) async throws -> String {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { throw OptimizerError.emptyDocument }
        let cleanDirection = direction.trimmingCharacters(in: .whitespacesAndNewlines)
        let system = """
        你是 TeachNova 文档优化助手。保持原始事实、专有名词和数据不变，只执行用户给出的优化方向。
        输出使用 Markdown：先给出“优化后内容”，再用不超过 3 条说明概述做了什么。不要虚构引用、事实或补充未知内容。
        """
        let request = cleanDirection.isEmpty ? clean : "优化方向：\(cleanDirection)\n\n原文：\n\(clean)"
        return try await DomesticAIClient(provider: provider, model: model, apiKey: apiKey)
            .send(messages: [String(request.prefix(28_000))], system: system)
    }

    enum OptimizerError: LocalizedError {
        case emptyDocument
        var errorDescription: String? { "请先导入或粘贴要优化的文档内容" }
    }
}

enum InteractiveActivityService {
    static func generateHTML(prompt: String, provider: AIProvider, model: String, apiKey: String) async throws -> String {
        let system = """
        你是 TeachNova 的 HTML5 课堂活动设计师。根据教师需求生成一个可直接在手机或电脑浏览器运行的中文互动课堂包。
        只输出完整 HTML 源码，不要 Markdown 代码块，不要解释。页面必须包含：活动标题、简短规则、至少一项可点击互动、即时反馈、重新开始按钮。
        不引用外部脚本、图片、字体或网络资源；使用内嵌 CSS 和 JavaScript。只使用用户明确给出的主题、受众、时长和约束；信息不足时在页面中显示“待教师补充”，不要虚构事实、数据或政策。
        """
        let result = try await DomesticAIClient(provider: provider, model: model, apiKey: apiKey)
            .send(messages: [prompt], system: system)
        let clean = htmlDocument(from: result)
        guard clean.localizedCaseInsensitiveContains("<html") else { throw ActivityError.invalidHTML }
        return clean
    }

    private static func htmlDocument(from output: String) -> String {
        let trimmed = output
            .replacingOccurrences(of: "```html", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let start = trimmed.range(of: "<html", options: .caseInsensitive),
              let end = trimmed.range(of: "</html>", options: .caseInsensitive) else { return trimmed }
        let before = trimmed[..<start.lowerBound]
        let document = String(trimmed[start.lowerBound..<end.upperBound])
        return before.localizedCaseInsensitiveContains("<!doctype") ? String(before) + document : "<!doctype html>\n" + document
    }

    enum ActivityError: LocalizedError {
        case invalidHTML
        var errorDescription: String? { "模型没有返回可运行的 HTML5 活动" }
    }
}

enum DocumentTextExtractor {
    static func extractDOCX(data: Data, endpointText: String) async throws -> String {
        guard let endpoint = URL(string: endpointText.trimmingCharacters(in: .whitespacesAndNewlines)),
              var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            throw ExtractionError.invalidEndpoint
        }
        components.path = "/api/extract"
        components.query = nil
        guard let extractionURL = components.url else { throw ExtractionError.invalidEndpoint }
        var request = URLRequest(url: extractionURL)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["fileName": "document.docx", "base64": data.base64EncodedString()])
        let (result, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let text = json["text"] as? String, !text.isEmpty else {
            throw ExtractionError.unavailable
        }
        return text
    }

    enum ExtractionError: LocalizedError {
        case invalidEndpoint
        case unavailable
        var errorDescription: String? {
            switch self {
            case .invalidEndpoint: return "文档解析服务地址无效"
            case .unavailable: return "DOCX 解析服务不可用，请启动 tools/pptx-service"
            }
        }
    }
}

struct WebLinkMetadata {
    let title: String
    let summary: String
}

/// Reads only public page metadata so a user can name a saved link without an API key.
enum WebLinkMetadataService {
    static func fetch(urlString: String) async throws -> WebLinkMetadata {
        guard let url = URL(string: urlString.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme),
              url.host != nil else {
            throw MetadataError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 15
        request.setValue("TeachNova/1.0", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<400).contains(httpResponse.statusCode) else {
            throw MetadataError.unavailable
        }

        let limitedData = Data(data.prefix(800_000))
        let html = String(data: limitedData, encoding: .utf8) ?? String(decoding: limitedData, as: UTF8.self)
        let title = firstMatch(in: html, patterns: [#"<title[^>]*>(.*?)</title>"#]) ?? url.host ?? "未命名网页"
        let summary = firstMatch(in: html, patterns: [
            #"<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']+)[\"']"#,
            #"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+name=[\"']description[\"']"#,
            #"<meta[^>]+property=[\"']og:description[\"'][^>]+content=[\"']([^\"']+)[\"']"#,
            #"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:description[\"']"#
        ]) ?? "已读取网页标题，可继续补充摘要。"
        return WebLinkMetadata(title: title, summary: summary)
    }

    private static func firstMatch(in html: String, patterns: [String]) -> String? {
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive, .dotMatchesLineSeparators]) else { continue }
            let range = NSRange(location: 0, length: html.utf16.count)
            guard let match = regex.firstMatch(in: html, options: [], range: range), match.numberOfRanges > 1,
                  let valueRange = Range(match.range(at: 1), in: html) else { continue }
            let value = decodeHTML(String(html[valueRange]))
            if !value.isEmpty { return value }
        }
        return nil
    }

    private static func decodeHTML(_ value: String) -> String {
        let stripped = value.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
        let decoded = stripped
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&nbsp;", with: " ")
        return decoded.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
    }

    enum MetadataError: LocalizedError {
        case invalidURL
        case unavailable

        var errorDescription: String? {
            switch self {
            case .invalidURL: return "请输入有效的 http(s) 网页链接"
            case .unavailable: return "网页暂时无法读取，请检查链接或手动填写名称"
            }
        }
    }
}
