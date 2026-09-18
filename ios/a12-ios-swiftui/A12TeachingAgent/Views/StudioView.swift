import SwiftUI

struct StudioView: View {
    @EnvironmentObject private var appState: A12AppState
    private let panels = ["对话", "预览"]
    @State private var shouldAutoScroll = true

    var body: some View {
        ZStack {
            DotGridBackground()
            VStack(spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(appState.messages.first(where: { $0.isUser }) == nil ? "AI 导论课项目" : "本次备课对话")
                            .font(.title3.weight(.bold))
                        Text(conversationSubtitle)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("智能体")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(Color.a12Blue)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.a12Blue.opacity(0.10), in: Capsule())
                        .overlay(Capsule().stroke(Color.a12Blue.opacity(0.28)))
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)

                Picker("工作台", selection: animatedPanel) {
                    ForEach(panels, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)

                ScrollViewReader { proxy in
                    ZStack(alignment: .bottomTrailing) {
                        ScrollView {
                            Group {
                                if appState.selectedStudioPanel == "对话" {
                                    ChatPanel()
                                    Color.clear
                                        .frame(height: 1)
                                        .id("teachnova-chat-bottom")
                                } else if appState.selectedStudioPanel == "预览" {
                                    PreviewPanel()
                                }
                            }
                            .id(appState.selectedStudioPanel)
                            .transition(
                                .asymmetric(
                                    insertion: .opacity.combined(with: .move(edge: .trailing)),
                                    removal: .opacity
                                )
                            )
                            .padding(20)
                        }
                        .simultaneousGesture(
                            DragGesture(minimumDistance: 6)
                                .onChanged { value in
                                    if appState.selectedStudioPanel == "对话", value.translation.height > 6 {
                                        shouldAutoScroll = false
                                    }
                                }
                        )

                        if !shouldAutoScroll && appState.isStreamingReply && appState.selectedStudioPanel == "对话" {
                            Button {
                                shouldAutoScroll = true
                                scrollToLatest(proxy)
                            } label: {
                                Label("回到最新", systemImage: "arrow.down")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 13)
                                    .padding(.vertical, 9)
                                    .background(Color.a12Gradient, in: Capsule())
                            }
                            .padding(20)
                        }
                    }
                    .onChange(of: appState.streamingReply) { _, _ in scrollToLatest(proxy) }
                    .onChange(of: appState.messages.count) { _, _ in scrollToLatest(proxy) }
                    .onChange(of: appState.conversationID) { _, _ in
                        shouldAutoScroll = true
                        DispatchQueue.main.async { scrollToLatest(proxy) }
                    }
                }
                .animation(.a12Smooth, value: appState.selectedStudioPanel)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .smoothScreenTransition()
    }

    private var conversationSubtitle: String {
        guard let request = appState.messages.first(where: { $0.isUser })?.text else {
            return "45 分钟 · 大一 · 案例教学"
        }
        let compact = request.replacingOccurrences(of: "\n", with: " ")
        return compact.count > 34 ? String(compact.prefix(34)) + "…" : compact
    }

    private var animatedPanel: Binding<String> {
        Binding(
            get: { appState.selectedStudioPanel },
            set: { newValue in
                withAnimation(.a12Smooth) { appState.selectedStudioPanel = newValue }
            }
        )
    }

    private func scrollToLatest(_ proxy: ScrollViewProxy) {
        guard shouldAutoScroll, appState.selectedStudioPanel == "对话" else { return }
        withAnimation(.easeOut(duration: 0.16)) {
            proxy.scrollTo("teachnova-chat-bottom", anchor: .bottom)
        }
    }
}

private struct ChatPanel: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var revision = ""
    @State private var freshRequest = ""
    @StateObject private var speech = SpeechRecognitionService()
    @FocusState private var revisionFocused: Bool
    @FocusState private var freshRequestFocused: Bool

    var body: some View {
        VStack(spacing: 12) {
            if appState.messages.isEmpty {
                GlassCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Label("新建备课对话", systemImage: "square.and.pencil")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(Color.a12Ink)
                        Text("描述课程主题、学生群体、时长或想要的课堂产物。")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ZStack(alignment: .topLeading) {
                            if freshRequest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !freshRequestFocused {
                                Text("例如：为大一学生设计一节 45 分钟的人工智能导论课")
                                    .foregroundStyle(Color.a12Ink.opacity(0.34))
                                    .padding(.horizontal, 4)
                                    .padding(.top, 5)
                                    .allowsHitTesting(false)
                            }
                            TextField("", text: $freshRequest, axis: .vertical)
                                .lineLimit(4...7)
                                .submitLabel(.send)
                                .onSubmit { sendFreshRequest() }
                                .focused($freshRequestFocused)
                                .frame(minHeight: 126, alignment: .topLeading)
                        }
                        HStack {
                            VoiceInputButton(
                                speech: speech,
                                sourceText: { freshRequest },
                                onTextChange: { freshRequest = $0 },
                                onError: { appState.showToast($0) }
                            )
                            Spacer()
                            Button("开始生成") { sendFreshRequest() }
                                .buttonStyle(GradientActionStyle())
                                .disabled(freshRequest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                }
            } else {
                ForEach(appState.messages) { message in
                    ChatBubble(message: message)
                }

                GenerationThoughtCard()

                if appState.isStreamingReply {
                    ChatBubble(message: ChatMessage(text: appState.streamingReply.isEmpty ? "正在整理回答…" : appState.streamingReply + "▍", isUser: false))
                }

                GlassCard {
                    VStack(spacing: 12) {
                        ZStack(alignment: .topLeading) {
                            if revision.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !revisionFocused {
                                Text("输入指令继续修改内容")
                                    .foregroundStyle(Color.a12Ink.opacity(0.34))
                                    .padding(.horizontal, 4)
                                    .padding(.top, 5)
                                    .allowsHitTesting(false)
                            }
                            TextField("", text: $revision, axis: .vertical)
                                .lineLimit(2...4)
                                .submitLabel(.send)
                                .onSubmit { sendRevision() }
                                .focused($revisionFocused)
                                .frame(minHeight: 72, alignment: .topLeading)
                        }
                        HStack {
                            VoiceInputButton(
                                speech: speech,
                                sourceText: { revision },
                                onTextChange: { revision = $0 },
                                onError: { appState.showToast($0) }
                            )

                            Spacer()

                            Button("发送") { sendRevision() }
                                .buttonStyle(.borderedProminent)
                                .tint(Color.a12Blue)
                        }
                    }
                }
            }
        }
        .animation(.a12Smooth, value: appState.messages.count)
        .animation(.linear(duration: 0.12), value: appState.streamingReply)
    }

    private func sendRevision() {
        let message = revision.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else {
            appState.showToast("请输入修改意见")
            return
        }
        appState.applyRevision(message)
        revision = ""
    }

    private func sendFreshRequest() {
        let request = freshRequest.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !request.isEmpty else { return }
        appState.prompt = request
        appState.runGeneration()
        freshRequest = ""
    }
}

private struct GenerationThoughtCard: View {
    @EnvironmentObject private var appState: A12AppState

    private let captions = [
        "识别目标、受众与课堂产物",
        "匹配本地资料与网页来源",
        "组织课程结构与互动环节",
        "逐字呈现模型回答"
    ]

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label(appState.isStreamingReply ? "正在输出回答" : "生成进度", systemImage: appState.isStreamingReply ? "text.line.first.and.arrowtriangle.forward" : "brain.head.profile")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(Color.a12Ink)
                    Spacer()
                    Text(appState.generationState)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.a12Blue)
                }

                ForEach(Array(appState.thinkingSteps.enumerated()), id: \.offset) { index, step in
                    HStack(spacing: 11) {
                        if index < appState.activeThinkingStep {
                            Image(systemName: "checkmark")
                                .font(.caption.weight(.black))
                                .foregroundStyle(Color.a12Blue)
                                .frame(width: 30, height: 30)
                                .background(Color.a12Blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                        } else if index == appState.activeThinkingStep && appState.activeThinkingStep < appState.thinkingSteps.count {
                            ProgressView()
                                .tint(Color.a12Blue)
                                .frame(width: 30, height: 30)
                                .background(Color.a12Blue.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
                        } else {
                            Circle()
                                .fill(Color.a12Ink.opacity(0.10))
                                .frame(width: 30, height: 30)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.a12Ink)
                            Text(captions[index])
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                }
            }
        }
    }
}

private struct PreviewPanel: View {
    @EnvironmentObject private var appState: A12AppState

    private var generatedContent: String? {
        if appState.isStreamingReply, !appState.streamingReply.isEmpty { return appState.streamingReply }
        return appState.messages.last(where: { !$0.isUser })?.text
    }

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                Label("当前问答文档", systemImage: "doc.text.magnifyingglass")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(Color.a12Ink)
                Text("会自动同步本次对话的最新生成结果")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let generatedContent, !generatedContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(DisplayTextFormatter.plain(generatedContent))
                        .font(.body)
                        .foregroundStyle(Color.a12Ink)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 18))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.a12Line.opacity(0.68)))
                } else {
                    ContentUnavailableView(
                        "等待生成内容",
                        systemImage: "text.badge.plus",
                        description: Text("发送备课需求后，这里会显示刚刚生成的文档。")
                    )
                    .frame(maxWidth: .infinity, minHeight: 220)
                }
            }
        }
    }
}
