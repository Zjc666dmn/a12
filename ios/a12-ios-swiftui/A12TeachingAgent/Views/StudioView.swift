import SwiftUI

struct StudioView: View {
    @EnvironmentObject private var appState: A12AppState
    var project: ProjectArtifact? = nil
    private let panels = StudioPanel.allCases
    @Namespace private var panelNS

    private var headerTitle: String {
        project?.title ?? "AI 导论课项目"
    }

    private var headerMeta: String {
        if let meta = project?.meta, !meta.isEmpty {
            return meta
        }
        return "45 分钟 · 大一 · 案例教学"
    }

    var body: some View {
        ZStack {
            AmbientBackground()
            VStack(spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(headerTitle)
                            .font(.title3.weight(.bold))
                        Text(headerMeta)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("Pi Agent")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.a12GreenGradient, in: Capsule())
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)

                HStack(spacing: 0) {
                    ForEach(panels, id: \.self) { panel in
                        Text(panel.rawValue)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(appState.selectedStudioPanel == panel ? Color.a12Ink : .secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                ZStack {
                                    if appState.selectedStudioPanel == panel {
                                        RoundedRectangle(cornerRadius: 12)
                                            .fill(Color.white)
                                            .matchedGeometryEffect(id: "panelIndicator", in: panelNS)
                                            .overlay {
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(Color.a12Separator, lineWidth: 1)
                                            }
                                            .shadow(color: .black.opacity(0.08), radius: 6, y: 3)
                                    }
                                }
                            )
                            .contentShape(Rectangle())
                            .accessibilityLabel("\(panel.rawValue)面板")
                            .accessibilityAddTraits(appState.selectedStudioPanel == panel ? [.isSelected] : [])
                            .onTapGesture {
                                A12Feedback.selection()
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                                    appState.selectedStudioPanel = panel
                                }
                            }
                    }
                }
                .padding(4)
                .background(Color.a12Chrome, in: RoundedRectangle(cornerRadius: 14))
                .overlay {
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.a12CardStroke, lineWidth: 1)
                }
                .padding(.horizontal, 20)

                ScrollView {
                    Group {
                        if appState.selectedStudioPanel == .conversation {
                            ChatPanel()
                        } else if appState.selectedStudioPanel == .preview {
                            PreviewPanel(project: project)
                        } else {
                            FilesPanel()
                        }
                    }
                    .padding(20)
                }
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ChatPanel: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var revision = "把案例换成校园生活场景，并让小游戏适合 4 人小组。"

    var body: some View {
        VStack(spacing: 12) {
            ForEach(appState.messages) { message in
                ChatBubble(message: message)
            }

            GlassCard {
                VStack(spacing: 12) {
                    ProgressRow(done: true, title: "需求结构化", subtitle: "教学目标、受众、时长、风格已确认")
                    ProgressRow(done: true, title: "RAG 检索", subtitle: "命中 8 条人工智能导论知识片段")
                    ProgressRow(done: appState.generationState == "已完成", title: "课件生成", subtitle: appState.generationDetail)
                }
            }

            GlassCard {
                VStack(spacing: 12) {
                    TextEditor(text: $revision)
                        .frame(height: 72)
                        .scrollContentBackground(.hidden)
                    HStack {
                        Button {
                            revision = "请把第三部分改成校园学习平台推荐案例，并补充一个课堂提问。"
                            appState.showToast("已模拟语音识别并填入文本")
                        } label: {
                            Image(systemName: "mic.fill")
                                .frame(width: 40, height: 40)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityLabel("语音输入修改意见")

                        Spacer()

                        Button("修改") {
                            appState.applyRevision(revision)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.a12Ink)
                    }
                }
            }
        }
    }
}

private struct PreviewPanel: View {
    @EnvironmentObject private var appState: A12AppState
    let project: ProjectArtifact?
    @State private var currentPage = 0

    private var totalPages: Int {
        project?.pageCount ?? 18
    }

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("第 \(currentPage + 1) 页 / \(totalPages) 页")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(.white.opacity(0.75))
                    Text(project?.title ?? "人工智能导论")
                        .font(.largeTitle.weight(.black))
                        .foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity, minHeight: 190, alignment: .bottomLeading)
                .padding(20)
                .background(
                    LinearGradient(colors: [Color.a12Ink, Color.a12GreenDark.opacity(0.82)], startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 18)
                )
                .overlay(
                    HStack {
                        if currentPage > 0 {
                            Button { withAnimation { currentPage -= 1 } } label: {
                                Image(systemName: "chevron.left.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(.white.opacity(0.8))
                            }
                        }
                        Spacer()
                        if currentPage < totalPages - 1 {
                            Button { withAnimation { currentPage += 1 } } label: {
                                Image(systemName: "chevron.right.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(.white.opacity(0.8))
                            }
                        }
                    }
                    .padding(.horizontal, 12),
                    alignment: .center
                )
                .gesture(
                    DragGesture(minimumDistance: 25)
                        .onEnded { value in
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                if value.translation.width < -30, currentPage < totalPages - 1 {
                                    currentPage += 1
                                } else if value.translation.width > 30, currentPage > 0 {
                                    currentPage -= 1
                                }
                            }
                        }
                )

                ProgressView(value: Double(currentPage + 1), total: Double(totalPages))
                    .tint(Color.a12Green)
                .frame(maxWidth: .infinity)

                ForEach(appState.outlineItems) { item in
                    OutlineRow(number: item.number, title: item.title, subtitle: item.subtitle)
                }

                HStack {
                    Button("导出 PPTX") {
                        A12Feedback.tap()
                        appState.showToast("已准备导出 PPTX")
                    }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.a12Ink)
                    Button("导出 DOCX") {
                        A12Feedback.tap()
                        appState.showToast("已准备导出 DOCX")
                    }
                        .buttonStyle(.bordered)
                        .tint(.a12Green)
                }
            }
        }
    }
}

private struct FilesPanel: View {
    @EnvironmentObject private var appState: A12AppState

    var body: some View {
        VStack(spacing: 12) {
            if appState.uploadedFiles.isEmpty {
                GlassCard {
                    VStack(spacing: 8) {
                        Image(systemName: "tray")
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(Color.a12Green)
                            .frame(width: 46, height: 46)
                            .background(Color.a12Green.opacity(0.1), in: Circle())

                        Text("暂无上传资料")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Color.a12Ink)

                        Text("在首页添加 PDF、图片、视频或文本后，这里会显示解析状态。")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
            }

            FileRow(kind: "PDF", color: .a12Green, title: "人工智能导论教材节选", subtitle: "已提取知识结构和案例", meta: "2.4M")
            FileRow(kind: "MP4", color: .a12GreenDark, title: "课堂演示视频片段", subtitle: "已生成 6 条摘要和关键帧", meta: "38M")
            FileRow(kind: "RAG", color: .a12Green, title: "本地专业知识库", subtitle: "128 条切片 · 向量检索可用", meta: "在线")

            ForEach(appState.uploadedFiles) { file in
                FileRow(
                    kind: file.kind,
                    color: .a12Green,
                    title: file.name,
                    subtitle: "已加入项目资料，等待 Pi Agent 解析",
                    meta: file.formattedSize
                )
            }

            GlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("生成产物")
                        .font(.headline.weight(.bold))
                    Text("AI_导论课件.pptx、AI_导论教案.docx、课堂互动小游戏.html")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 10) {
                        Button("全部下载") {
                            A12Feedback.tap()
                            appState.showToast("已准备下载完整课堂包")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.a12Ink)

                        Button("继续优化") {
                            appState.selectedStudioPanel = .conversation
                        }
                        .buttonStyle(.bordered)
                        .tint(.a12Green)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}
