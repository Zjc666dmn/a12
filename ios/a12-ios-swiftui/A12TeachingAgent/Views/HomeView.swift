import SwiftUI
import UniformTypeIdentifiers

struct HomeView: View {
    @EnvironmentObject private var appState: A12AppState

    var body: some View {
        ZStack {
            DotGridBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    hero
                    quickActions
                    artifactPicker
                    PromptComposer()
                    projects
                }
                .padding(.horizontal, 18)
                .padding(.top, 10)
                .padding(.bottom, 24)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .smoothScreenTransition()
    }

    private var header: some View {
        HStack {
            A12Logo(compact: true)
            Spacer()
            Button { appState.activeTab = 3 } label: {
                Image(systemName: "bell.badge.fill")
                    .foregroundStyle(Color.a12Blue)
                    .frame(width: 42, height: 42)
                    .background(.white.opacity(0.8), in: Circle())
                    .overlay(Circle().stroke(Color.a12Line.opacity(0.7)))
            }
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 26)
                .fill(LinearGradient(colors: [Color.white.opacity(0.92), Color.a12Cyan.opacity(0.2), Color.a12Purple.opacity(0.14)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 26).stroke(.white))
            Circle().fill(Color.a12Blue.opacity(0.10)).frame(width: 150, height: 150).offset(x: 38, y: 38)
            ZStack {
                RoundedRectangle(cornerRadius: 24).fill(Color.a12Gradient).frame(width: 92, height: 112).rotationEffect(.degrees(-8))
                RoundedRectangle(cornerRadius: 18).fill(.white.opacity(0.22)).frame(width: 64, height: 75)
                Text("AI").font(.system(size: 28, weight: .black, design: .rounded)).foregroundStyle(.white)
            }
            .shadow(color: Color.a12Blue.opacity(0.32), radius: 18, y: 12)
            .padding(.trailing, 24)
            .padding(.bottom, 22)
            VStack(alignment: .leading, spacing: 8) {
                Text("你好，老师 👋").font(.caption.weight(.semibold)).foregroundStyle(Color.a12Blue)
                Text("智能生成教案\n让备课更轻松")
                    .font(.system(size: 25, weight: .black, design: .rounded))
                    .foregroundStyle(Color.a12Ink)
                Text("AI 助力教学 · 提升备课效率").font(.caption).foregroundStyle(.secondary)
                Button {
                    appState.startFreshConversation()
                } label: {
                    Label("开始创作", systemImage: "arrow.right")
                        .font(.caption.weight(.bold)).foregroundStyle(.white)
                        .padding(.horizontal, 15).padding(.vertical, 9)
                        .background(Color.a12Gradient, in: Capsule())
                }
                .padding(.top, 3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(22)
        }
        .frame(height: 210)
        .shadow(color: Color.a12Ink.opacity(0.06), radius: 20, y: 10)
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("AI 教学工具", subtitle: "一键完成备课")
            HStack(spacing: 10) {
                FeatureTile(title: "智能教案", subtitle: "快速生成", icon: "wand.and.stars", colors: [.a12Cyan, .a12Blue]) { appState.select(.lessonPlan) }
                FeatureTile(title: "生成 PPT", subtitle: "多套风格", icon: "rectangle.on.rectangle.fill", colors: [.a12Purple, .a12Blue]) { appState.showPPTGenerator = true }
                FeatureTile(title: "文档优化", subtitle: "智能润色", icon: "doc.text.fill", colors: [Color.orange.opacity(0.8), .a12Purple]) { appState.showDocumentOptimizer = true }
            }
        }
    }

    private var artifactPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(ArtifactType.allCases) { artifact in
                    ChipButton(title: artifact.rawValue, icon: artifact == .deck ? "sparkles" : nil, active: appState.selectedArtifact == artifact) { appState.select(artifact) }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private var projects: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("最近创作").font(.title3.weight(.bold)).foregroundStyle(Color.a12Ink)
                Spacer()
                Button("查看全部") { appState.showRecentCreations = true }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.a12Blue)
            }
            if appState.recentConversations.isEmpty {
                GlassCard {
                    Label("还没有创作记录", systemImage: "clock.arrow.circlepath")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.a12Ink.opacity(0.58))
                        .frame(maxWidth: .infinity, minHeight: 74, alignment: .center)
                }
            } else {
                ForEach(appState.recentConversations) { conversation in
                    ConversationRecordCard(conversation: conversation) {
                        appState.openConversation(conversation)
                    }
                }
            }
        }
    }

    private func sectionTitle(_ title: String, subtitle: String) -> some View {
        HStack {
            Text(title).font(.title3.weight(.bold)).foregroundStyle(Color.a12Ink)
            Spacer()
            Text(subtitle).font(.caption).foregroundStyle(Color.a12Blue)
        }
    }
}

private struct PromptComposer: View {
    @EnvironmentObject private var appState: A12AppState
    @StateObject private var speech = SpeechRecognitionService()
    @State private var showingFileImporter = false
    @FocusState private var promptFocused: Bool

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.a12Blue.opacity(0.12))
                        Image(systemName: "sparkles")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Color.a12Blue)
                    }
                    .frame(width: 38, height: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("告诉 AI 你的备课需求")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(Color.a12Ink)
                        Text("描述目标、受众和想要的课堂产物")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Label("回车发送", systemImage: "return")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color.a12Blue)
                }

                ZStack(alignment: .topLeading) {
                    if appState.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !promptFocused {
                        Text("例如：帮我给大一学生设计一节人工智能导论课")
                            .font(.body)
                            .foregroundStyle(Color.a12Ink.opacity(0.34))
                            .padding(.horizontal, 16)
                            .padding(.top, 17)
                            .allowsHitTesting(false)
                    }
                    TextField("", text: $appState.prompt, axis: .vertical)
                        .font(.body)
                        .foregroundStyle(Color.a12Ink)
                        .lineLimit(5...8)
                        .submitLabel(.send)
                        .onSubmit { sendPrompt() }
                        .focused($promptFocused)
                        .frame(minHeight: 126, alignment: .topLeading)
                        .padding(15)
                }
                .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color.a12Line.opacity(0.72)))

                HStack(spacing: 14) {
                    VoiceInputButton(
                        speech: speech,
                        sourceText: { appState.prompt },
                        onTextChange: { appState.prompt = $0 },
                        onError: { appState.showToast($0) }
                    )
                    Button {
                        showingFileImporter = true
                    } label: {
                        Label("添加资料", systemImage: "paperclip")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.a12Blue)
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 4)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(appState.generationState)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text("\(appState.prompt.count) 字")
                            .font(.caption2)
                            .foregroundStyle(Color.a12Ink.opacity(0.35))
                    }
                    Button(action: sendPrompt) {
                        HStack(spacing: 7) {
                            Text("生成")
                            Image(systemName: "arrow.up")
                        }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .frame(height: 48)
                        .background(Color.a12Gradient, in: Capsule())
                        .shadow(color: Color.a12Blue.opacity(0.30), radius: 12, y: 6)
                    }
                    .buttonStyle(.plain)
                    .contentShape(Capsule())
                    .accessibilityLabel("发送备课需求")
                    .disabled(appState.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .opacity(appState.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
                }
            }
        }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: [.pdf, .data, .plainText, .commaSeparatedText],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                appState.importFiles(urls)
                appState.activeTab = 2
            case .failure(let error):
                appState.showToast("资料选择失败：\(error.localizedDescription)")
            }
        }
    }

    private func sendPrompt() {
        appState.runGeneration()
    }
}

private struct ConversationRecordCard: View {
    let conversation: ConversationRecord
    let action: () -> Void

    private var dateText: String {
        conversation.createdAt.formatted(date: .abbreviated, time: .shortened)
    }

    var body: some View {
        Button(action: action) {
            GlassCard {
                HStack(spacing: 14) {
                    CreationIcon(record: conversation)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(conversation.title)
                            .font(.headline.weight(.bold))
                            .foregroundStyle(Color.a12Ink)
                            .lineLimit(1)
                        Text(conversation.preview)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                        Text(dateText)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.a12Blue)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(Color.a12Blue.opacity(0.7))
                }
            }
        }
        .buttonStyle(.plain)
    }
}
