import SwiftUI
import UniformTypeIdentifiers
import PDFKit
import QuickLook
import WebKit

struct ProjectsView: View {
    @EnvironmentObject private var appState: A12AppState

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("课程工作台")
                        .font(.largeTitle.weight(.black))
                    Text("三项产物均已接入真实生成流程：可编辑 PPT、文档优化和 HTML5 互动活动。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    ForEach(appState.artifacts) { artifact in
                        ArtifactCard(artifact: artifact) {
                            openWorkflow(for: artifact)
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("项目")
        .smoothScreenTransition()
    }

    private func openWorkflow(for artifact: ProjectArtifact) {
        withAnimation(.a12Smooth) { appState.activeTab = 0 }
        DispatchQueue.main.async {
            switch artifact.kind {
            case "PPTX":
                appState.showPPTGenerator = true
            case "DOCX":
                appState.showDocumentOptimizer = true
            default:
                appState.showInteractiveClassroom = true
            }
        }
    }
}

struct KnowledgeView: View {
    @EnvironmentObject private var appState: A12AppState
    @Environment(\.openURL) private var openURL
    @State private var showingFileImporter = false
    @State private var webQuery = "人工智能教育 教学设计"
    @State private var linkURL = ""
    @State private var linkTitle = ""
    @State private var linkSummary = ""
    @State private var namingLink = false
    @State private var selectedCategory: KnowledgeCategory?

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("全网知识库")
                        .font(.largeTitle.weight(.black))
                    Text("真实网页来源可点击查看；本地资料仍可继续导入。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    GlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Label("全网检索入口", systemImage: "safari")
                                .font(.headline.weight(.bold))
                            Text("输入主题后跳转百度搜索。找到有价值的网页，复制链接到下方即可保存。")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            HStack(spacing: 10) {
                                TextField("例如：人工智能课程标准", text: $webQuery)
                                    .textFieldStyle(.plain)
                                    .padding(12)
                                    .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                                Button {
                                    let query = webQuery.trimmingCharacters(in: .whitespacesAndNewlines)
                                    guard !query.isEmpty,
                                          let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                                          let url = URL(string: "https://www.baidu.com/s?wd=\(encoded)") else {
                                        appState.showToast("请输入检索关键词")
                                        return
                                    }
                                    openURL(url)
                                } label: {
                                    Image(systemName: "arrow.up.right.square.fill")
                                        .font(.title3.weight(.bold))
                                        .foregroundStyle(.white)
                                        .frame(width: 48, height: 46)
                                        .background(Color.a12Gradient, in: RoundedRectangle(cornerRadius: 14))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("去百度搜索")
                            }
                        }
                    }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            KnowledgeCategoryChip(title: "全部", icon: "square.grid.2x2", active: selectedCategory == nil) {
                                withAnimation(.a12Smooth) { selectedCategory = nil }
                            }
                            ForEach(KnowledgeCategory.allCases) { category in
                                KnowledgeCategoryChip(title: category.rawValue, icon: category.icon, active: selectedCategory == category) {
                                    withAnimation(.a12Smooth) { selectedCategory = category }
                                }
                            }
                        }
                    }

                    GlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("知识库状态")
                                    .font(.headline.weight(.bold))
                                Spacer()
                                Text("已收录")
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(Color.a12Blue)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.a12Blue.opacity(0.10), in: Capsule())
                            }
                            Text("已收录 \(appState.knowledgeLinks.count) 条真实网页来源，另有 \(appState.importedFiles.count) 个本地资料。")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            ProgressRow(done: true, title: "网页来源", subtitle: "教育部、上海教育、UNESCO 等公开页面，支持点击查看")
                            ProgressRow(done: !appState.importedFiles.isEmpty, title: "本地资料", subtitle: appState.importedFiles.isEmpty ? "可导入 PDF、DOCX、PPTX、TXT、MD、CSV" : "已保存到本机应用资料目录")
                        }
                    }

                    let visibleLinks = appState.knowledgeLinks.filter { selectedCategory == nil || $0.category == selectedCategory }
                    if !visibleLinks.isEmpty {
                        Text("已收录网页来源")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(Color.a12Ink)
                        ForEach(visibleLinks) { link in
                            NavigationLink {
                                KnowledgeLinkDetailView(link: link)
                            } label: {
                                KnowledgeLinkRow(link: link)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button("移除链接", role: .destructive) {
                                    appState.removeKnowledgeLink(link)
                                }
                            }
                        }
                    }

                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("保存网页链接", systemImage: "link.badge.plus")
                                .font(.headline.weight(.bold))
                            Text("智能命名会读取网页公开的标题和简介，不需要 API Key；保存后下次可直接从知识库进入。")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("粘贴网页链接（https://...）", text: $linkURL)
                                .textFieldStyle(.plain)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .keyboardType(.URL)
                                .padding(12)
                                .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                            TextField("名称（可由智能命名填写）", text: $linkTitle)
                                .textFieldStyle(.plain)
                                .padding(12)
                                .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                            TextField("摘要（可选）", text: $linkSummary, axis: .vertical)
                                .lineLimit(2...4)
                                .textFieldStyle(.plain)
                                .padding(12)
                                .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                            HStack(spacing: 10) {
                                Button {
                                    Task { await smartNameLink() }
                                } label: {
                                    Label(namingLink ? "读取中" : "智能命名", systemImage: namingLink ? "hourglass" : "wand.and.stars")
                                }
                                .buttonStyle(.bordered)
                                .tint(.a12Blue)
                                .disabled(namingLink || linkURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                                Button("保存到知识库") {
                                    if appState.saveKnowledgeLink(title: linkTitle, summary: linkSummary, urlString: linkURL) {
                                        linkURL = ""
                                        linkTitle = ""
                                        linkSummary = ""
                                    }
                                }
                                .buttonStyle(GradientActionStyle())
                            }
                        }
                    }

                    if !appState.importedFiles.isEmpty {
                        Text("本地导入资料")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(Color.a12Ink)
                        ForEach(appState.importedFiles) { file in
                            FileRow(
                                kind: file.kind,
                                color: importedFileColor(file.fileType),
                                title: file.name,
                                subtitle: file.summary,
                                meta: file.sizeText
                            )
                            .contextMenu {
                                Button("移除资料", role: .destructive) {
                                    appState.removeImportedFile(file)
                                }
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .smoothScreenTransition()
        .toolbar {
            Button {
                showingFileImporter = true
            } label: {
                Image(systemName: "plus")
            }
        }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: [.pdf, .data, .plainText, .commaSeparatedText],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls): appState.importFiles(urls)
            case .failure(let error): appState.showToast("资料选择失败：\(error.localizedDescription)")
            }
        }
    }

    private func smartNameLink() async {
        namingLink = true
        defer { namingLink = false }
        do {
            let metadata = try await WebLinkMetadataService.fetch(urlString: linkURL)
            linkTitle = metadata.title
            linkSummary = metadata.summary
            appState.showToast("已读取网页标题和简介，可直接保存")
        } catch {
            appState.showToast("自动命名失败：\(error.localizedDescription)")
        }
    }

    private func importedFileColor(_ type: String) -> Color {
        switch type.lowercased() {
        case "pdf": return .red
        case "docx": return .a12Blue
        case "pptx": return .orange
        case "md", "txt", "csv": return .a12Purple
        default: return .a12Blue
        }
    }
}

private struct KnowledgeLinkRow: View {
    let link: KnowledgeLink

    var body: some View {
        GlassCard {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(link.isSeed ? Color.a12Blue.opacity(0.13) : Color.a12Purple.opacity(0.13))
                    Image(systemName: link.isSeed ? "checkmark.seal.fill" : "link")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(link.isSeed ? Color.a12Blue : Color.a12Purple)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text(link.title)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color.a12Ink)
                        .lineLimit(2)
                    Text("\(link.category.rawValue) · \(link.source) · \(link.host)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color.a12Blue)
                        .lineLimit(1)
                    Text(link.summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct KnowledgeCategoryChip: View {
    let title: String
    let icon: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(active ? .white : Color.a12Ink.opacity(0.62))
                .padding(.horizontal, 13)
                .padding(.vertical, 9)
                .background(active ? AnyShapeStyle(Color.a12Gradient) : AnyShapeStyle(Color.white.opacity(0.78)), in: Capsule())
                .overlay(Capsule().stroke(active ? .white.opacity(0.48) : Color.a12Line.opacity(0.65)))
        }
        .buttonStyle(.plain)
    }
}

struct KnowledgeLinkDetailView: View {
    let link: KnowledgeLink

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Label(link.isSeed ? "已验证公开来源" : "已保存网页来源", systemImage: link.isSeed ? "checkmark.seal.fill" : "link")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color.a12Blue)
                    Text(link.title)
                        .font(.largeTitle.weight(.black))
                        .foregroundStyle(Color.a12Ink)
                    GlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("内容摘要")
                                .font(.headline.weight(.bold))
                            Text(link.summary)
                                .font(.body)
                                .foregroundStyle(.secondary)
                            Divider()
                            Text("来源：\(link.source)")
                                .font(.subheadline.weight(.semibold))
                            Text(link.urlString)
                                .font(.caption)
                                .foregroundStyle(Color.a12Blue)
                                .textSelection(.enabled)
                        }
                    }
                    if let extractedContent = link.extractedContent {
                        GlassCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Label("已提取要点", systemImage: "doc.text.magnifyingglass")
                                    .font(.headline.weight(.bold))
                                    .foregroundStyle(Color.a12Ink)
                                Text(extractedContent)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    } else {
                        GlassCard {
                            Label("暂保留网页链接", systemImage: "link")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.a12Blue)
                            Text("该来源暂未做本地正文提取，打开原网页查看完整内容。")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let url = link.url {
                        Link(destination: url) {
                            Label("打开原网页", systemImage: "arrow.up.right.square.fill")
                        }
                        .buttonStyle(GradientActionStyle())
                    }
                    Text("网页内容由原站提供，TeachNova 保存的是链接和公开元数据；打开后可查看最新版本。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(20)
            }
        }
        .navigationTitle("来源详情")
        .navigationBarTitleDisplayMode(.inline)
        .smoothScreenTransition()
    }
}

struct ProfileView: View {
    @EnvironmentObject private var appState: A12AppState

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    A12Logo(compact: true)
                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("智能体后端")
                                    .font(.headline.weight(.bold))
                                Spacer()
                                Text(appState.connectionState)
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(Color.a12Blue)
                            }
                            Text("支持国内模型直连；API Key 仅保存在本机 Keychain。")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    NavigationLink { AIModelSettingsView() } label: {
                        SettingsRow(icon: "brain.head.profile", title: "模型与智能体", subtitle: "\(appState.selectedProvider.displayName) · \(appState.selectedModel)")
                    }
                    .buttonStyle(.plain)
                    NavigationLink { ExportSettingsView() } label: {
                        SettingsRow(icon: "square.and.arrow.down", title: "导出设置", subtitle: "默认 \(appState.exportFormat.rawValue) · 来源\(appState.includeSources ? "已包含" : "不包含")")
                    }
                    .buttonStyle(.plain)
                    NavigationLink { TeamSpaceView() } label: {
                        SettingsRow(icon: "person.3", title: "团队空间", subtitle: "\(appState.teamName) · \(appState.teamMembers.count) 人")
                    }
                    .buttonStyle(.plain)
                }
                .padding(20)
            }
        }
        .navigationTitle("我的")
        .smoothScreenTransition()
    }
}

private struct SettingsRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        GlassCard {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title3.weight(.bold))
                    .frame(width: 42, height: 42)
                    .background(Color.a12Blue.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(Color.a12Blue)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.headline.weight(.bold))
                    Text(subtitle).font(.footnote).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct AIModelSettingsView: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var testing = false
    @State private var showProviderPicker = false
    @State private var showModelPicker = false

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("模型与智能体").font(.largeTitle.weight(.black)).foregroundStyle(Color.a12Ink)
                    Text("选择国内模型，填写对应 API Key 即可直连。密钥只保存在本机。")
                        .font(.subheadline).foregroundStyle(.secondary)

                    GlassCard {
                        VStack(alignment: .leading, spacing: 14) {
                            SelectionButton(title: "服务商", value: appState.selectedProvider.displayName, icon: "building.2.fill") {
                                showProviderPicker = true
                            }
                            SelectionButton(title: "模型", value: appState.selectedModel, icon: "cpu.fill") {
                                showModelPicker = true
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("API Key").font(.caption.weight(.bold)).foregroundStyle(Color.a12Ink)
                                SecureField("粘贴 API Key", text: $appState.apiKey)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(12)
                                    .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                            }
                            Text(appState.selectedProvider.endpoint.absoluteString)
                                .font(.caption2).foregroundStyle(.secondary).lineLimit(1)

                            HStack(spacing: 10) {
                                Button("保存设置") { appState.saveAISettings() }
                                    .buttonStyle(GradientActionStyle())
                                Button {
                                    testing = true
                                    Task {
                                        await appState.testConnection()
                                        testing = false
                                    }
                                } label: {
                                    Label(testing ? "连接中" : "测试连接", systemImage: testing ? "hourglass" : "checkmark.shield")
                                }
                                .buttonStyle(.bordered)
                                .tint(.a12Blue)
                                .disabled(testing)
                            }
                            if let hint = appState.connectionHint {
                                Text(hint)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(hint.hasPrefix("连接失败") ? Color.red.opacity(0.82) : Color.a12Ink)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 10)
                                    .background((hint.hasPrefix("连接失败") ? Color.red : Color.a12Blue).opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke((hint.hasPrefix("连接失败") ? Color.red : Color.a12Blue).opacity(0.22)))
                            }
                            HStack(spacing: 6) {
                                Circle().fill(appState.connectionState == "已连接" ? Color.green : Color.orange).frame(width: 8, height: 8)
                                Text(appState.connectionState).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Text("已预置 DeepSeek、通义千问、智谱 GLM、Kimi、百度文心、百川、Yi、腾讯混元的兼容接口。")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding(20)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showProviderPicker) {
            ProviderSelectionSheet { provider in
                appState.providerChanged(provider)
                showProviderPicker = false
            }
            .presentationDetents([.medium, .large])
            .presentationCornerRadius(28)
        }
        .sheet(isPresented: $showModelPicker) {
            ModelSelectionSheet(provider: appState.selectedProvider, selectedModel: appState.selectedModel) { model in
                appState.selectedModel = model
                showModelPicker = false
            }
            .presentationDetents([.medium, .large])
            .presentationCornerRadius(28)
        }
    }
}

private struct SelectionButton: View {
    let title: String
    let value: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon).foregroundStyle(Color.a12Blue).frame(width: 28)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.caption).foregroundStyle(.secondary)
                    Text(value).font(.subheadline.weight(.semibold)).foregroundStyle(Color.a12Ink)
                }
                Spacer()
                Image(systemName: "chevron.up.chevron.down").font(.caption.weight(.bold)).foregroundStyle(Color.a12Blue)
            }
            .padding(13)
            .background(.white.opacity(0.76), in: RoundedRectangle(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).stroke(Color.a12Line.opacity(0.72)))
        }
        .buttonStyle(.plain)
    }
}

private struct ProviderSelectionSheet: View {
    @EnvironmentObject private var appState: A12AppState
    let onSelect: (AIProvider) -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                DotGridBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("选择服务商").font(.largeTitle.weight(.black)).foregroundStyle(Color.a12Ink)
                        Text("均为国内模型兼容接口，选择后可继续挑选具体模型。")
                            .font(.subheadline).foregroundStyle(.secondary)
                        ForEach(AIProvider.allCases) { provider in
                            Button { onSelect(provider) } label: {
                                HStack(spacing: 13) {
                                    Image(systemName: provider == appState.selectedProvider ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(provider == appState.selectedProvider ? Color.a12Blue : Color.a12Line)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(provider.displayName).font(.headline.weight(.bold)).foregroundStyle(Color.a12Ink)
                                        Text("\(provider.models.count) 个可选模型").font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                }
                                .padding(14)
                                .background(provider == appState.selectedProvider ? Color.a12Blue.opacity(0.10) : .white.opacity(0.72), in: RoundedRectangle(cornerRadius: 17))
                                .overlay(RoundedRectangle(cornerRadius: 17).stroke(provider == appState.selectedProvider ? Color.a12Blue.opacity(0.55) : Color.a12Line.opacity(0.65)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(20)
                }
            }
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("完成") { onSelect(appState.selectedProvider) } } }
        }
    }
}

private struct ModelSelectionSheet: View {
    let provider: AIProvider
    let selectedModel: String
    let onSelect: (String) -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                DotGridBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("选择模型").font(.largeTitle.weight(.black)).foregroundStyle(Color.a12Ink)
                        Text(provider.displayName).font(.subheadline.weight(.semibold)).foregroundStyle(Color.a12Blue)
                        ForEach(provider.models, id: \.self) { model in
                            Button { onSelect(model) } label: {
                                HStack {
                                    Image(systemName: model == selectedModel ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(model == selectedModel ? Color.a12Blue : Color.a12Line)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(model).font(.headline.weight(.bold)).foregroundStyle(Color.a12Ink)
                                        Text(modelHint(model)).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                }
                                .padding(14)
                                .background(model == selectedModel ? Color.a12Blue.opacity(0.10) : .white.opacity(0.72), in: RoundedRectangle(cornerRadius: 17))
                                .overlay(RoundedRectangle(cornerRadius: 17).stroke(model == selectedModel ? Color.a12Blue.opacity(0.55) : Color.a12Line.opacity(0.65)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(20)
                }
            }
        }
    }

    private func modelHint(_ model: String) -> String {
        if model.contains("reasoner") || model.contains("thinking") { return "深度推理 · 复杂任务" }
        if model.contains("turbo") || model.contains("flash") || model.contains("lightning") { return "快速响应 · 高频使用" }
        if model.contains("max") || model.contains("large") || model.contains("pro") { return "高质量输出 · 专业任务" }
        return "均衡能力 · 日常教学"
    }
}

struct ExportSettingsView: View {
    @EnvironmentObject private var appState: A12AppState

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("导出设置").font(.largeTitle.weight(.black)).foregroundStyle(Color.a12Ink)
                    Text("选择默认格式与导出内容，设置会保存在本机。")
                        .font(.subheadline).foregroundStyle(.secondary)
                    GlassCard {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("默认格式").font(.caption.weight(.bold)).foregroundStyle(Color.a12Ink)
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                ForEach(ExportFormat.allCases) { format in
                                    Button {
                                        withAnimation(.a12Smooth) { appState.exportFormat = format }
                                    } label: {
                                        HStack(spacing: 9) {
                                            Image(systemName: format.icon).font(.headline).foregroundStyle(format.accent.last ?? Color.a12Blue)
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(format.rawValue).font(.subheadline.weight(.bold)).foregroundStyle(Color.a12Ink)
                                                Text(format == appState.exportFormat ? "已选择" : "点击选择").font(.caption2).foregroundStyle(.secondary)
                                            }
                                            Spacer()
                                        }
                                        .padding(11)
                                        .background(format == appState.exportFormat ? (format.accent.first ?? Color.a12Blue).opacity(0.12) : Color.white.opacity(0.65), in: RoundedRectangle(cornerRadius: 14))
                                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(format == appState.exportFormat ? (format.accent.last ?? Color.a12Blue).opacity(0.65) : Color.a12Line.opacity(0.55)))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            GlassCard {
                                HStack(spacing: 12) {
                                    Image(systemName: appState.exportFormat.icon).font(.title2).foregroundStyle(appState.exportFormat.accent.last ?? Color.a12Blue)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("\(appState.exportFormat.rawValue) 设计说明").font(.subheadline.weight(.bold)).foregroundStyle(Color.a12Ink)
                                        Text(appState.exportFormat.description).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                            Toggle("附带知识库来源说明", isOn: $appState.includeSources)
                            Toggle("自动保留最近导出文件", isOn: $appState.autoSaveExports)
                            Button("保存导出设置") { appState.saveExportSettings() }
                                .buttonStyle(GradientActionStyle())
                        }
                    }
                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("立即生成示例文件", systemImage: "doc.badge.plus")
                                .font(.headline.weight(.bold))
                            Text("当前工程可直接生成并分享 HTML5 / Markdown 内容预览；PPTX、DOCX 需接入对应文档生成服务。")
                                .font(.caption).foregroundStyle(.secondary)
                            Button("生成并分享") { appState.exportArtifact() }
                                .buttonStyle(GradientActionStyle())
                            if let url = appState.lastExportURL {
                                ShareLink(item: url) { Label("分享最近文件", systemImage: "square.and.arrow.up") }
                                    .font(.subheadline.weight(.semibold)).foregroundStyle(Color.a12Blue)
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct TeamSpaceView: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var newName = ""
    @State private var newEmail = ""
    @State private var newRole: TeamRole = .editor
    @State private var newCanOperate = true

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("团队空间").font(.largeTitle.weight(.black)).foregroundStyle(Color.a12Ink)
                    GlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("空间名称").font(.caption.weight(.bold)).foregroundStyle(Color.a12Ink)
                            TextField("团队名称", text: $appState.teamName)
                                .padding(12).background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                            Button("保存空间") { appState.saveTeamName() }.buttonStyle(GradientActionStyle())
                        }
                    }
                    Text("成员（\(appState.teamMembers.count)）").font(.title3.weight(.bold)).foregroundStyle(Color.a12Ink)
                    ForEach(appState.teamMembers) { member in
                        GlassCard {
                            HStack(spacing: 12) {
                                Image(systemName: member.role == .admin ? "person.crop.circle.fill" : "person.crop.circle")
                                    .font(.title2).foregroundStyle(Color.a12Blue)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(member.name).font(.headline.weight(.bold))
                                    Text(member.email).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 3) {
                                    Text(member.role.rawValue).font(.caption.weight(.semibold)).foregroundStyle(Color.a12Blue)
                                    Label(member.canOperate ? "可操作项目" : "只读", systemImage: member.canOperate ? "checkmark.shield" : "lock")
                                        .font(.caption2).foregroundStyle(member.canOperate ? Color.green : .secondary)
                                }
                            }
                        }
                        .contextMenu {
                            if member.role != .admin { Button("移除成员", role: .destructive) { appState.removeTeamMember(member) } }
                        }
                    }
                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("添加成员").font(.headline.weight(.bold))
                            TextField("姓名", text: $newName).textInputAutocapitalization(.words)
                            TextField("邮箱", text: $newEmail).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                            Picker("角色", selection: $newRole) {
                                ForEach(TeamRole.allCases) { Text($0.rawValue).tag($0) }
                            }
                            .pickerStyle(.menu)
                            Toggle("允许操作项目", isOn: $newCanOperate)
                            Button("添加到团队") {
                                appState.addTeamMember(name: newName, email: newEmail, role: newRole, canOperate: newCanOperate)
                                newName = ""; newEmail = ""; newRole = .editor; newCanOperate = true
                            }
                            .buttonStyle(GradientActionStyle())
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct RecentCreationsView: View {
    @EnvironmentObject private var appState: A12AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                DotGridBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("全部创作记录")
                            .font(.largeTitle.weight(.black))
                            .foregroundStyle(Color.a12Ink)
                        Text("备课对话、PPT 和文档优化结果都会保存在这里。")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        if appState.recentConversations.isEmpty {
                            GlassCard {
                                Label("还没有保存的创作记录", systemImage: "clock.arrow.circlepath")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                    .frame(maxWidth: .infinity, minHeight: 110)
                            }
                        } else {
                            ForEach(appState.recentConversations) { record in
                                NavigationLink {
                                    SavedConversationDetail(record: record)
                                } label: {
                                    GlassCard {
                                        HStack(spacing: 12) {
                                            CreationIcon(record: record, size: 48)
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(record.title)
                                                    .font(.headline.weight(.bold))
                                                    .foregroundStyle(Color.a12Ink)
                                                    .lineLimit(1)
                                                Text(record.preview)
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                                    .lineLimit(2)
                                                Text(record.createdAt.formatted(date: .abbreviated, time: .shortened))
                                                    .font(.caption2.weight(.semibold))
                                                    .foregroundStyle(Color.a12Blue)
                                            }
                                            Spacer(minLength: 0)
                                            Image(systemName: "chevron.right")
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(Color.a12Blue.opacity(0.68))
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                        .font(.subheadline.weight(.semibold))
                }
            }
        }
    }
}

private struct SavedConversationDetail: View {
    let record: ConversationRecord
    @State private var showPPTPreview = false

    private var artifactURL: URL? {
        guard let path = record.artifactPath, FileManager.default.fileExists(atPath: path) else { return nil }
        return URL(fileURLWithPath: path)
    }

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(record.title)
                        .font(.title2.weight(.black))
                        .foregroundStyle(Color.a12Ink)
                    Text(record.createdAt.formatted(date: .long, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if record.creationType == "ppt", artifactURL != nil {
                        Button {
                            showPPTPreview = true
                        } label: {
                            Label("预览真实 PPT 文件", systemImage: "play.rectangle.fill")
                        }
                        .buttonStyle(GradientActionStyle())
                    } else if (record.creationType == "document" || record.creationType == "game"), let artifactURL {
                        ShareLink(item: artifactURL) {
                            Label(record.creationType == "game" ? "分享互动课堂包" : "分享优化后的文档", systemImage: "square.and.arrow.up")
                        }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color.a12Blue)
                    }
                    ForEach(record.messages) { message in
                        ChatBubble(message: message)
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("创作详情")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPPTPreview) {
            if let artifactURL {
                PPTFilePreview(url: artifactURL)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
        }
    }
}

struct DocumentOptimizerView: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var sourceText = ""
    @State private var optimizedText = ""
    @State private var sourceName = "未导入文档"
    @State private var showingFileImporter = false
    @State private var isOptimizing = false
    @State private var outputURL: URL?
    @State private var optimizationDirection = ""
    @State private var revisionDirection = ""
    @AppStorage("teachnova.pptServiceURL") private var serviceURL = "http://localhost:8787/api/export/pptx"
    @FocusState private var editorFocused: Bool

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("文档优化")
                        .font(.largeTitle.weight(.black))
                        .foregroundStyle(Color.a12Ink)
                    Text("导入 PDF、DOCX、TXT 或 Markdown，模型会在保留原有事实的前提下优化表达与教学结构。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    GlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Label(sourceName, systemImage: "doc.badge.plus")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Color.a12Ink)
                                    .lineLimit(1)
                                Spacer()
                                Button("导入文档") { showingFileImporter = true }
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Color.a12Blue)
                            }

                            ZStack(alignment: .topLeading) {
                                if sourceText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !editorFocused {
                                    Text("也可以直接粘贴需要优化的文档内容")
                                        .foregroundStyle(Color.a12Ink.opacity(0.34))
                                        .padding(.horizontal, 14)
                                        .padding(.top, 14)
                                        .allowsHitTesting(false)
                                }
                                TextField("", text: $sourceText, axis: .vertical)
                                    .focused($editorFocused)
                                    .lineLimit(8...14)
                                    .frame(minHeight: 210, alignment: .topLeading)
                                    .padding(12)
                            }
                            .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18))
                            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.a12Line.opacity(0.72)))

                            VStack(alignment: .leading, spacing: 9) {
                                Text("优化方向")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(Color.a12Ink)
                                TextField("例如：保留事实，改成更适合课堂讲解的表达", text: $optimizationDirection, axis: .vertical)
                                    .lineLimit(2...3)
                                    .padding(11)
                                    .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(directionSuggestions, id: \.self) { suggestion in
                                            Button(suggestion) { appendDirection(suggestion) }
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(Color.a12Blue)
                                                .padding(.horizontal, 11)
                                                .padding(.vertical, 8)
                                                .background(Color.a12Blue.opacity(0.10), in: Capsule())
                                                .overlay(Capsule().stroke(Color.a12Blue.opacity(0.18)))
                                        }
                                    }
                                }
                            }

                            Button {
                                optimize()
                            } label: {
                                Label(isOptimizing ? "正在优化…" : "开始优化", systemImage: "wand.and.stars")
                            }
                            .buttonStyle(GradientActionStyle())
                            .disabled(isOptimizing || sourceText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }

                    if !optimizedText.isEmpty {
                        GlassCard {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Label("优化结果", systemImage: "text.badge.checkmark")
                                        .font(.headline.weight(.bold))
                                    Spacer()
                                    if let outputURL {
                                        ShareLink(item: outputURL) {
                                            Image(systemName: "square.and.arrow.up")
                                        }
                                        .foregroundStyle(Color.a12Blue)
                                    }
                                }
                                Text(optimizedText)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.a12Ink)
                                    .textSelection(.enabled)

                                Divider()
                                Text("继续修改")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(Color.a12Ink)
                                TextField("例如：压缩为 300 字，并突出课堂活动", text: $revisionDirection, axis: .vertical)
                                    .lineLimit(2...3)
                                    .padding(11)
                                    .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(directionSuggestions, id: \.self) { suggestion in
                                            Button(suggestion) { appendRevision(suggestion) }
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(Color.a12Blue)
                                                .padding(.horizontal, 11)
                                                .padding(.vertical, 8)
                                                .background(Color.a12Blue.opacity(0.10), in: Capsule())
                                        }
                                    }
                                }
                                Button {
                                    continueOptimizing()
                                } label: {
                                    Label(isOptimizing ? "正在继续生成…" : "继续修改并生成", systemImage: "arrow.triangle.2.circlepath")
                                }
                                .buttonStyle(GradientActionStyle())
                                .disabled(isOptimizing || revisionDirection.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: [.pdf, .plainText, .commaSeparatedText, .data],
            allowsMultipleSelection: false
        ) { result in
            guard case let .success(urls) = result, let url = urls.first else {
                if case let .failure(error) = result { appState.showToast("文档导入失败：\(error.localizedDescription)") }
                return
            }
            Task { await loadDocument(url) }
        }
    }

    private func loadDocument(_ url: URL) async {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            let ext = url.pathExtension.lowercased()
            let text: String
            switch ext {
            case "pdf":
                guard let pdf = PDFDocument(url: url), let content = pdf.string, !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    throw DocumentLoadError.noReadableText
                }
                text = content
            case "txt", "md", "csv":
                text = try String(contentsOf: url, encoding: .utf8)
            case "docx":
                let data = try Data(contentsOf: url)
                text = try await DocumentTextExtractor.extractDOCX(data: data, endpointText: serviceURL)
            default:
                throw DocumentLoadError.unsupported
            }
            sourceName = url.lastPathComponent
            sourceText = text
            optimizedText = ""
            outputURL = nil
            appState.showToast("已读取 \(url.lastPathComponent)")
        } catch {
            appState.showToast("无法读取文档：\(error.localizedDescription)")
        }
    }

    private func optimize() {
        let content = sourceText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        runOptimization(content: content, direction: optimizationDirection, followUp: false)
    }

    private func continueOptimizing() {
        let direction = revisionDirection.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !direction.isEmpty else { return }
        runOptimization(content: optimizedText, direction: direction, followUp: true)
    }

    private func runOptimization(content: String, direction: String, followUp: Bool) {
        guard !appState.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            appState.showToast("请先在“我的 > 模型与智能体”填写 API Key")
            return
        }
        isOptimizing = true
        Task {
            defer { isOptimizing = false }
            do {
                let result = try await DocumentOptimizerService.optimize(text: content, direction: direction, provider: appState.selectedProvider, model: appState.selectedModel, apiKey: appState.apiKey)
                optimizedText = result
                let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
                let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                    .appendingPathComponent("TeachNova/CreatedFiles", isDirectory: true)
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                let destination = folder.appendingPathComponent("TeachNova-优化结果-\(stamp).md")
                guard let data = result.data(using: .utf8) else { return }
                try data.write(to: destination, options: .atomic)
                outputURL = destination
                let title = sourceName == "未导入文档" ? "文档优化" : "\(sourceName) · 文档优化"
                let request = direction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "优化原文表达与结构" : "优化方向：\(direction)"
                appState.saveCreation(title: title, request: request, summary: result, creationType: "document", artifactPath: destination.path)
                if followUp { revisionDirection = "" }
                appState.showToast(followUp ? "已按新方向生成文档" : "文档优化完成")
            } catch {
                appState.showToast("优化失败：\(error.localizedDescription)")
            }
        }
    }

    private enum DocumentLoadError: LocalizedError {
        case unsupported
        case noReadableText
        var errorDescription: String? {
            switch self {
            case .unsupported: return "支持 PDF、DOCX、TXT、MD、CSV"
            case .noReadableText: return "PDF 中没有可提取的文本"
            }
        }
    }

    private let directionSuggestions = ["扩写细节", "续写下文", "精简压缩", "润色表达", "检测语病", "修正错别字", "调整语气", "教学化改写", "提炼大纲", "生成摘要", "检查逻辑", "转换 Markdown"]

    private func appendDirection(_ suggestion: String) {
        let current = optimizationDirection.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !current.contains(suggestion) else { return }
        optimizationDirection = current.isEmpty ? suggestion : "\(current)、\(suggestion)"
    }

    private func appendRevision(_ suggestion: String) {
        let current = revisionDirection.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !current.contains(suggestion) else { return }
        revisionDirection = current.isEmpty ? suggestion : "\(current)、\(suggestion)"
    }
}

struct InteractiveClassroomView: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var request = ""
    @State private var html = ""
    @State private var outputURL: URL?
    @State private var isGenerating = false
    @FocusState private var requestFocused: Bool

    private let suggestions = ["四人小组", "课堂抢答", "情境闯关", "判断题", "案例讨论", "课后复习"]

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("互动课堂包")
                        .font(.largeTitle.weight(.black))
                        .foregroundStyle(Color.a12Ink)
                    Text("使用当前已连接的模型生成可运行的 HTML5 互动活动，生成后可直接预览与分享。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    GlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Label("活动需求", systemImage: "gamecontroller.fill")
                                .font(.headline.weight(.bold))
                            ZStack(alignment: .topLeading) {
                                if request.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !requestFocused {
                                    Text("例如：为 4 人小组设计一个 10 分钟的 AI 伦理判断闯关活动")
                                        .foregroundStyle(Color.a12Ink.opacity(0.34))
                                        .padding(.horizontal, 12)
                                        .padding(.top, 12)
                                        .allowsHitTesting(false)
                                }
                                TextField("", text: $request, axis: .vertical)
                                    .focused($requestFocused)
                                    .lineLimit(4...6)
                                    .frame(minHeight: 120, alignment: .topLeading)
                                    .padding(12)
                            }
                            .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18))
                            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.a12Line.opacity(0.72)))

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(suggestions, id: \.self) { suggestion in
                                        Button(suggestion) { appendSuggestion(suggestion) }
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(Color.a12Blue)
                                            .padding(.horizontal, 11)
                                            .padding(.vertical, 8)
                                            .background(Color.a12Blue.opacity(0.10), in: Capsule())
                                    }
                                }
                            }
                            Button {
                                generateActivity()
                            } label: {
                                Label(isGenerating ? "正在生成互动活动…" : "生成互动课堂包", systemImage: "sparkles.rectangle.stack")
                            }
                            .buttonStyle(GradientActionStyle())
                            .disabled(isGenerating || request.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }

                    if !html.isEmpty {
                        GlassCard {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Label("活动预览", systemImage: "play.rectangle.fill")
                                        .font(.headline.weight(.bold))
                                    Spacer()
                                    if let outputURL {
                                        ShareLink(item: outputURL) {
                                            Label("分享 HTML", systemImage: "square.and.arrow.up")
                                        }
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(Color.a12Blue)
                                    }
                                }
                                HTMLActivityPreview(html: html)
                                    .frame(height: 480)
                                    .clipShape(RoundedRectangle(cornerRadius: 18))
                                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.a12Line.opacity(0.68)))
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func appendSuggestion(_ suggestion: String) {
        let clean = request.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.contains(suggestion) else { return }
        request = clean.isEmpty ? suggestion : "\(clean)，\(suggestion)"
    }

    private func generateActivity() {
        let prompt = request.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }
        guard !appState.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            appState.showToast("请先在“我的 > 模型与智能体”填写 API Key")
            return
        }
        isGenerating = true
        Task {
            defer { isGenerating = false }
            do {
                let result = try await InteractiveActivityService.generateHTML(prompt: prompt, provider: appState.selectedProvider, model: appState.selectedModel, apiKey: appState.apiKey)
                html = result
                let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                    .appendingPathComponent("TeachNova/CreatedFiles", isDirectory: true)
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
                let file = folder.appendingPathComponent("TeachNova-互动课堂包-\(stamp).html")
                guard let data = result.data(using: .utf8) else { throw InteractiveActivityService.ActivityError.invalidHTML }
                try data.write(to: file, options: .atomic)
                outputURL = file
                appState.saveCreation(title: "互动课堂包", request: prompt, summary: "已生成可运行的 HTML5 互动课堂活动。", creationType: "game", artifactPath: file.path)
                appState.showToast("互动课堂包已生成，可立即试玩")
            } catch {
                appState.showToast("互动课堂包生成失败：\(error.localizedDescription)")
            }
        }
    }
}

private struct HTMLActivityPreview: UIViewRepresentable {
    let html: String

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.preferences.isElementFullscreenEnabled = true
        return WKWebView(frame: .zero, configuration: configuration)
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        webView.loadHTMLString(html, baseURL: nil)
    }
}

struct PPTGeneratorView: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var request = ""
    @State private var deck: PPTDeck?
    @State private var exportURL: URL?
    @State private var editingSlide: PPTDeckSlide?
    @State private var pptDirection = ""
    @State private var showPPTPreview = false
    @State private var phase = "先生成可编辑大纲，再导出真实 PPTX 文件"
    @State private var isGeneratingOutline = false
    @State private var isExportingPPT = false
    @State private var isModifyingOutline = false
    @State private var showPPTService = false
    @AppStorage("teachnova.pptServiceURL") private var serviceURL = "http://localhost:8787/api/export/pptx"
    @FocusState private var requestFocused: Bool

    private var isBusy: Bool { isGeneratingOutline || isExportingPPT || isModifyingOutline }

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("生成 PPT")
                        .font(.largeTitle.weight(.black))
                        .foregroundStyle(Color.a12Ink)
                    Text("先生成可编辑的页级大纲；确认并修改后，再由项目内置的服务写入可打开的 PPTX。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    GlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("课件需求")
                                .font(.headline.weight(.bold))
                            ZStack(alignment: .topLeading) {
                                if request.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !requestFocused {
                                    Text("例如：为大一学生生成一节 45 分钟的人工智能导论课")
                                        .foregroundStyle(Color.a12Ink.opacity(0.34))
                                        .padding(.horizontal, 14)
                                        .padding(.top, 14)
                                        .allowsHitTesting(false)
                                }
                                TextField("", text: $request, axis: .vertical)
                                    .focused($requestFocused)
                                    .lineLimit(5...8)
                                    .frame(minHeight: 132, alignment: .topLeading)
                                    .padding(12)
                            }
                            .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18))
                            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.a12Line.opacity(0.72)))

                            DisclosureGroup("PPTX 服务", isExpanded: $showPPTService) {
                                TextField("服务地址", text: $serviceURL)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .font(.caption)
                                    .padding(10)
                                    .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 12))
                                Text("开发环境默认使用项目中的 tools/pptx-service；部署时将此地址替换为你的 HTTPS 服务。")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .font(.subheadline.weight(.semibold))

                            HStack {
                                Text(phase)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                                Spacer()
                                if isBusy { ProgressView().tint(Color.a12Blue) }
                            }

                            Button {
                                if deck == nil { generateOutline() }
                                else { generatePPT() }
                            } label: {
                                if deck == nil {
                                    Label(isGeneratingOutline ? "正在生成大纲…" : "生成 PPT 大纲", systemImage: "list.bullet.rectangle")
                                } else {
                                    Label(isExportingPPT ? "正在生成 PPT…" : "生成 PPT", systemImage: "rectangle.on.rectangle.angled")
                                }
                            }
                            .buttonStyle(GradientActionStyle())
                            .disabled(isBusy || request.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            if deck != nil {
                                Text("您可以修改大纲")
                                    .font(.caption)
                                    .foregroundStyle(Color.a12Ink.opacity(0.48))
                                    .frame(maxWidth: .infinity)
                            }
                        }
                    }

                    if let deck {
                        GlassCard {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(deck.title).font(.headline.weight(.bold))
                                        Text(deck.subtitle).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if exportURL != nil {
                                        Button {
                                            showPPTPreview = true
                                        } label: {
                                            Label("预览 PPT", systemImage: "play.rectangle.fill")
                                        }
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(Color.a12Blue)
                                    }
                                }
                                Text("点击任一页面即可全屏编辑标题与要点")
                                    .font(.caption)
                                    .foregroundStyle(Color.a12Ink.opacity(0.52))
                                ForEach(Array(deck.slides.enumerated()), id: \.offset) { index, slide in
                                    Button { editingSlide = slide } label: {
                                        HStack(alignment: .top, spacing: 10) {
                                            Text("\(index + 1)")
                                                .font(.caption.weight(.black))
                                                .foregroundStyle(.white)
                                                .frame(width: 28, height: 28)
                                                .background(Color.a12Gradient, in: Circle())
                                            VStack(alignment: .leading, spacing: 5) {
                                                Text(slide.title)
                                                    .font(.subheadline.weight(.bold))
                                                    .foregroundStyle(Color.a12Ink)
                                                Text(slide.bullets.joined(separator: " · "))
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                                    .multilineTextAlignment(.leading)
                                                    .lineLimit(3)
                                            }
                                            Spacer(minLength: 0)
                                            Image(systemName: "arrow.up.left.and.arrow.down.right")
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(Color.a12Blue)
                                                .padding(8)
                                                .background(Color.a12Blue.opacity(0.10), in: Circle())
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(12)
                                        .background(Color.a12Blue.opacity(0.07), in: RoundedRectangle(cornerRadius: 15))
                                    }
                                    .buttonStyle(.plain)
                                }

                                Divider()
                                VStack(alignment: .leading, spacing: 9) {
                                    Text("修改 PPT")
                                        .font(.subheadline.weight(.bold))
                                    TextField("例如：加入更多互动，把语言调整为小学一年级可理解的表达", text: $pptDirection, axis: .vertical)
                                        .lineLimit(2...3)
                                        .padding(11)
                                        .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14))
                                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.a12Line.opacity(0.7)))
                                    ScrollView(.horizontal, showsIndicators: false) {
                                        HStack(spacing: 8) {
                                            ForEach(pptDirectionSuggestions, id: \.self) { suggestion in
                                                Button(suggestion) { appendPPTDirection(suggestion) }
                                                    .font(.caption.weight(.semibold))
                                                    .foregroundStyle(Color.a12Blue)
                                                    .padding(.horizontal, 11)
                                                    .padding(.vertical, 8)
                                                    .background(Color.a12Blue.opacity(0.10), in: Capsule())
                                            }
                                        }
                                    }
                                    Button {
                                        modifyPPT()
                                    } label: {
                                        Label(isModifyingOutline ? "正在修改 PPT…" : "修改 PPT", systemImage: "slider.horizontal.3")
                                    }
                                    .buttonStyle(GradientActionStyle())
                                    .disabled(isBusy || pptDirection.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                                }

                                if let exportURL {
                                    HStack(spacing: 10) {
                                        Button {
                                            showPPTPreview = true
                                        } label: {
                                            Label("查看真实 PPT 文件", systemImage: "doc.richtext")
                                        }
                                        .buttonStyle(.borderedProminent)
                                        .tint(Color.a12Blue)
                                        ShareLink(item: exportURL) {
                                            Label("分享", systemImage: "square.and.arrow.up")
                                        }
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Color.a12Blue)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $editingSlide) { slide in
            PPTSlideEditor(slide: slide) { updated in
                guard var currentDeck = deck,
                      let index = currentDeck.slides.firstIndex(where: { $0.id == updated.id }) else { return }
                currentDeck.slides[index] = updated
                deck = currentDeck
                editingSlide = nil
                exportURL = nil
                phase = "大纲已修改，点击“生成 PPT”即可导出"
            }
        }
        .sheet(isPresented: $showPPTPreview) {
            if let exportURL {
                PPTFilePreview(url: exportURL)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    private func generateOutline() {
        let prompt = request.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }
        guard prompt.replacingOccurrences(of: " ", with: "").count >= 6 else {
            appState.showToast("请补充课件主题、受众或时长后再生成大纲")
            return
        }
        guard !appState.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            appState.showToast("请先在“我的 > 模型与智能体”填写 API Key")
            return
        }
        isGeneratingOutline = true
        exportURL = nil
        Task {
            defer { isGeneratingOutline = false }
            do {
                phase = "正在由 \(appState.selectedProvider.displayName) 编排页面…"
                let generatedDeck = try await PPTPlanService.create(prompt: prompt, provider: appState.selectedProvider, model: appState.selectedModel, apiKey: appState.apiKey)
                deck = generatedDeck
                phase = "大纲已生成。可点击任一页全屏修改，再生成 PPT"
                appState.showToast("PPT 大纲已生成，可继续编辑")
            } catch {
                phase = "大纲生成失败"
                appState.showToast("PPT 大纲生成失败：\(error.localizedDescription)")
            }
        }
    }

    private func generatePPT() {
        guard let currentDeck = deck else { return }
        isExportingPPT = true
        exportURL = nil
        Task {
            defer { isExportingPPT = false }
            do {
                phase = "正在写入真实 PPTX 文件…"
                let file = try await PPTXService.export(deck: currentDeck, endpointText: serviceURL)
                exportURL = file
                appState.lastExportURL = file
                appState.saveCreation(title: "\(currentDeck.title) · PPT", request: request, summary: "已生成 \(currentDeck.slides.count) 页 PPTX，可点击记录或当前页面预览真实文件。", creationType: "ppt", artifactPath: file.path)
                phase = "PPTX 已生成，可预览、分享或继续修改"
                appState.showToast("已生成真实 PPTX 文件，点击“预览 PPT”查看")
            } catch {
                phase = "生成失败"
                appState.showToast("PPT 生成失败：\(error.localizedDescription)")
            }
        }
    }

    private let pptDirectionSuggestions = ["增加互动", "精简文字", "课堂提问", "补充案例", "调整难度", "改成小学版", "改成大学版", "加强总结"]

    private func appendPPTDirection(_ suggestion: String) {
        let current = pptDirection.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !current.contains(suggestion) else { return }
        pptDirection = current.isEmpty ? suggestion : "\(current)、\(suggestion)"
    }

    private func modifyPPT() {
        guard let currentDeck = deck else { return }
        let direction = pptDirection.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !direction.isEmpty else { return }
        guard !appState.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            appState.showToast("请先在“我的 > 模型与智能体”填写 API Key")
            return
        }
        isModifyingOutline = true
        Task {
            defer { isModifyingOutline = false }
            do {
                phase = "正在按修改方向调整 PPT 大纲…"
                deck = try await PPTPlanService.revise(deck: currentDeck, direction: direction, provider: appState.selectedProvider, model: appState.selectedModel, apiKey: appState.apiKey)
                exportURL = nil
                pptDirection = ""
                phase = "PPT 大纲已修改，点击“生成 PPT”即可导出新文件"
                appState.showToast("PPT 已按修改方向更新")
            } catch {
                phase = "PPT 修改失败"
                appState.showToast("PPT 修改失败：\(error.localizedDescription)")
            }
        }
    }
}

private struct PPTFilePreview: UIViewControllerRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator(url: url) }

    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {
        context.coordinator.url = url
        uiViewController.reloadData()
    }

    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        var url: URL

        init(url: URL) { self.url = url }

        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            url as NSURL
        }
    }
}

private struct PPTSlideEditor: View {
    let slide: PPTDeckSlide
    let onSave: (PPTDeckSlide) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var bulletsText: String

    init(slide: PPTDeckSlide, onSave: @escaping (PPTDeckSlide) -> Void) {
        self.slide = slide
        self.onSave = onSave
        _title = State(initialValue: slide.title)
        _bulletsText = State(initialValue: slide.bullets.joined(separator: "\n"))
    }

    var body: some View {
        ZStack {
            DotGridBackground()
            VStack(spacing: 0) {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(Color.a12Ink)
                            .frame(width: 42, height: 42)
                            .background(.white.opacity(0.78), in: Circle())
                    }
                    Spacer()
                    Text("编辑页面大纲")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color.a12Ink)
                    Spacer()
                    Color.clear.frame(width: 42, height: 42)
                }
                .padding(.horizontal, 20)
                .padding(.top, 14)

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        Text("页面大纲")
                            .font(.largeTitle.weight(.black))
                            .foregroundStyle(Color.a12Ink)
                        Text("修改标题与要点后保存，PPT 将按此版本生成。")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        GlassCard {
                            VStack(alignment: .leading, spacing: 14) {
                                Text("页面标题")
                                    .font(.caption.weight(.bold))
                                TextField("页面标题", text: $title)
                                    .font(.title3.weight(.bold))
                                    .padding(12)
                                    .background(.white.opacity(0.76), in: RoundedRectangle(cornerRadius: 15))
                                Text("页面要点（每行一个）")
                                    .font(.caption.weight(.bold))
                                TextEditor(text: $bulletsText)
                                    .font(.body)
                                    .foregroundStyle(Color.a12Ink)
                                    .scrollContentBackground(.hidden)
                                    .frame(minHeight: 300)
                                    .padding(10)
                                    .background(.white.opacity(0.76), in: RoundedRectangle(cornerRadius: 18))
                                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.a12Line.opacity(0.7)))
                            }
                        }
                    }
                    .padding(20)
                }

                Button("保存页面") { save() }
                    .buttonStyle(GradientActionStyle())
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)
            }
        }
    }

    private func save() {
        let points = bulletsText
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let updated = PPTDeckSlide(id: slide.id, title: title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? slide.title : title.trimmingCharacters(in: .whitespacesAndNewlines), bullets: points)
        onSave(updated)
    }
}
