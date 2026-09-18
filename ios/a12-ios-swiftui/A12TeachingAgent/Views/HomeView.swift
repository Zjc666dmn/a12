import SwiftUI
import UniformTypeIdentifiers

struct HomeView: View {
    @EnvironmentObject private var appState: A12AppState

    var body: some View {
        ZStack {
            AmbientBackground()

            VStack(spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("锐捷 A12")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.secondary)
                        Text("教学智能体")
                            .font(.title.weight(.black))
                            .foregroundStyle(Color.a12Text)
                    }

                    Spacer()

                    Text("AI")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                        .background(Color.a12Ink, in: Circle())
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        heroCard
                            .staggeredAppear(index: 0)

                        ScrollViewReader { proxy in
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(ArtifactType.allCases) { artifact in
                                        ChipButton(
                                            title: artifact.rawValue,
                                            icon: artifact.systemImage,
                                            active: appState.selectedArtifact == artifact
                                        ) {
                                            appState.select(artifact)
                                        }
                                        .id(artifact)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                            .onChange(of: appState.selectedArtifact) { _, artifact in
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                                    proxy.scrollTo(artifact, anchor: .center)
                                }
                            }
                            .onAppear {
                                proxy.scrollTo(appState.selectedArtifact, anchor: .center)
                            }
                        }

                        quickStartSection
                            .staggeredAppear(index: 2)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 28)
                }

                PromptComposer()
                    .padding(.horizontal, 20)
                    .padding(.bottom, 18)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Pi Agent 已连接")
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)

            Text("把教学想法变成课件和教案")
                .font(.title.weight(.black))
                .foregroundStyle(Color.a12Text)

            Text("语音输入、资料解析、RAG 知识融合、PPT 与 Word 一站生成。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 152, alignment: .topLeading)
        .background(Color.a12GlassFill, in: RoundedRectangle(cornerRadius: 22))
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RadialGradient(
                colors: [Color.a12Green.opacity(0.12), .clear],
                center: UnitPoint(x: 0.88, y: 0.22),
                startRadius: 0,
                endRadius: 180
            )
            .clipShape(RoundedRectangle(cornerRadius: 22))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color.a12CardStroke, lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.04), radius: 12, y: 6)
    }

    private var quickStartSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom) {
                Text("快速开始")
                    .font(.headline.weight(.bold))

                Spacer()

                Button("更多模板") {
                    A12Feedback.tap()
                    appState.showToast("已展开推荐模板：导论课、实验课、复习课、说课稿")
                }
                .font(.caption.weight(.bold))
                .tint(Color.a12Green)
                .buttonStyle(.plain)
            }

            VStack(spacing: 10) {
                HomeTemplateCard(
                    icon: "rectangle.on.rectangle",
                    title: "导论课共创",
                    meta: "12 分钟",
                    subtitle: "自动追问目标、时长、知识点和课堂互动。"
                ) {
                    A12Feedback.tap()
                    appState.selectedArtifact = .deck
                    appState.prompt = ArtifactType.deck.prompt
                    appState.showStudio = true
                    appState.selectedStudioPanel = .conversation
                    appState.showToast("已套用导论课共创模板")
                }

                HomeTemplateCard(
                    icon: "doc.text",
                    title: "教案生成",
                    meta: "Word",
                    subtitle: "同步生成教学目标、过程、活动与作业。"
                ) {
                    A12Feedback.tap()
                    appState.select(.lessonPlan)
                }

                HomeTemplateCard(
                    icon: "square.grid.2x2",
                    title: "资料融合",
                    meta: "PDF/视频",
                    subtitle: "提取参考资料结构、案例与风格。"
                ) {
                    A12Feedback.tap()
                    appState.activeTab = 2
                    appState.showToast("已进入资料融合与知识库页面")
                }
            }
        }
    }
}

private struct PromptComposer: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var showFileImporter = false
    @State private var pulsing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
                TextEditor(text: $appState.prompt)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.a12Text.opacity(0.82))
                .frame(minHeight: 88, maxHeight: 140)
                .scrollContentBackground(.hidden)
                .overlay(alignment: .topLeading) {
                    if appState.prompt.isEmpty {
                        Text("请输入教学需求…")
                            .font(.body)
                            .foregroundStyle(Color.a12Text.opacity(0.3))
                            .padding(.top, 8)
                            .padding(.leading, 5)
                            .allowsHitTesting(false)
                    }
                }

            HStack(spacing: 12) {
                Button {
                    showFileImporter = true
                } label: {
                    Image(systemName: "plus")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Color.a12Text)
                        .frame(width: 38, height: 38)
                        .background(Color.a12IconTile, in: Circle())
                        .overlay(Circle().stroke(Color.a12Separator))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("添加参考资料")

                Spacer()

                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.a12Green)
                        .frame(width: 8, height: 8)
                    Text(appState.generationState)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.a12Text.opacity(0.7))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.a12GlassFillStrong, in: Capsule())
                .accessibilityLabel("生成状态：\(appState.generationState)")

                Button {
                    appState.prompt = "请生成一节 45 分钟的人工智能导论课，面向大一学生，要求案例来自校园生活。"
                    appState.showToast("已模拟语音识别并填入文本")
                } label: {
                        Image(systemName: "mic.fill")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Color.a12Text.opacity(0.7))
                            .frame(width: 38, height: 38)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("语音输入")

                Button {
                    appState.runGeneration()
                } label: {
                    ZStack {
                        if !appState.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Circle()
                                .fill(Color.a12Green.opacity(0.4))
                                .frame(width: 48, height: 48)
                                .scaleEffect(pulsing ? 1.5 : 1.0)
                                .opacity(pulsing ? 0 : 0.6)
                                .animation(.easeOut(duration: 1.4).repeatForever(autoreverses: false), value: pulsing)
                        }
                        Image(systemName: "paperplane.fill")
                            .font(.body.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(width: 48, height: 48)
                            .background(Color.a12Ink, in: Circle())
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("开始生成")
                .onAppear { pulsing = true }
            }
        }
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color.a12CardStroke, lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.05), radius: 14, y: 7)
        .fileImporter(
            isPresented: $showFileImporter,
            allowedContentTypes: [.pdf, .image, .movie, .text, .item],
            allowsMultipleSelection: true
        ) { results in
            appState.addUploadedFiles(results)
        }
    }
}

private struct HomeTemplateCard: View {
    let icon: String
    let title: String
    let meta: String
    let subtitle: String
    let action: () -> Void
    @State private var pressed = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                    Image(systemName: icon)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Color.a12Green)
                        .frame(width: 54, height: 54)
                        .background(Color.a12IconTile, in: RoundedRectangle(cornerRadius: 16))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.a12Separator)
                    }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(title)
                            .font(.subheadline.weight(.bold))

                        Spacer()

                        Text(meta)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }
            }
            .padding(14)
            .background(Color.a12GlassFillStrong, in: RoundedRectangle(cornerRadius: 18))
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
            .overlay {
                RoundedRectangle(cornerRadius: 18)
                    .stroke(Color.a12CardStroke, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.05), radius: 12, y: 6)
            .scaleEffect(pressed ? 0.98 : 1)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded { _ in pressed = false }
        )
    }
}
