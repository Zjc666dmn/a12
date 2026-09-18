import SwiftUI

struct ProjectsView: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var selectedProject: ProjectArtifact?

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("最近项目")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                    Text("课程工作台")
                        .font(.largeTitle.weight(.black))

                    ForEach(appState.projects) { project in
                        ArtifactCard(artifact: project) {
                            A12Feedback.tap()
                            selectedProject = project
                            appState.selectedStudioPanel = .preview
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("项目")
        .navigationDestination(item: $selectedProject) { project in
            StudioView(project: project)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    A12Feedback.tap()
                    appState.activeTab = 0
                    appState.showToast("已进入新建项目")
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .onChange(of: appState.activeTab) {
            if appState.activeTab != 1 {
                selectedProject = nil
            }
        }
    }
}

struct KnowledgeView: View {
    @EnvironmentObject private var appState: A12AppState

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("本地知识库")
                        .font(.largeTitle.weight(.black))

                    GlassCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("知识库状态")
                                    .font(.headline.weight(.bold))
                                Spacer()
                                Text("在线")
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(Color.a12Green)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.a12Green.opacity(0.13), in: Capsule())
                            }
                            Text("128 条文本切片，覆盖人工智能导论、课程大纲、案例素材和课堂活动设计。")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            ProgressRow(done: true, title: "文本向量化", subtitle: "PDF、Word、PPT 已完成解析", meta: "100%")
                            ProgressRow(done: true, title: "视频摘要", subtitle: "关键帧与讲解摘要已入库", meta: "6 条")
                        }
                    }

                    FileRow(kind: "PDF", color: .a12Green, title: "人工智能导论教材节选", subtitle: "知识点、案例、章节结构", meta: "已入库")
                    FileRow(kind: "MP4", color: .a12GreenDark, title: "AI 应用课堂视频", subtitle: "关键帧、摘要、课堂问答", meta: "已入库")
                    FileRow(kind: "DOC", color: .a12Green, title: "课程标准与教学大纲", subtitle: "目标、重难点、考核方式", meta: "已入库")
                }
                .padding(20)
            }
        }
        .navigationTitle("知识库")
        .toolbar {
                Button {
                    A12Feedback.tap()
                    appState.showToast("已模拟上传资料")
            } label: {
                Image(systemName: "plus")
            }
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var appState: A12AppState

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Account")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.secondary)
                            Text("我的")
                                .font(.largeTitle.weight(.black))
                        }

                        Spacer()

                        Text("师")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(width: 42, height: 42)
                            .background(Color.a12Ink, in: Circle())
                    }

                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("Pi Agent 后端")
                                    .font(.headline.weight(.bold))
                                Spacer()
                                Text("已连接")
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(Color.a12Green)
                            }
                            Text("当前为前端演示模式，已预留对话流、任务进度、文件列表和导出接口。")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    SettingsRow(icon: "brain.head.profile", title: "模型与智能体", subtitle: "需求理解、RAG、课件生成", meta: "配置") {
                        A12Feedback.tap()
                        appState.showToast("模型设置：当前演示使用 Pi Agent + RAG 编排")
                    }
                    SettingsRow(icon: "square.and.arrow.down", title: "导出设置", subtitle: "PPT、Word、HTML5 小游戏", meta: "默认") {
                        A12Feedback.tap()
                        appState.showToast("导出设置：PPTX、DOCX、HTML5 已启用")
                    }
                    SettingsRow(icon: "person.3", title: "团队空间", subtitle: "比赛材料、演示视频、补充资料", meta: "3 人") {
                        A12Feedback.tap()
                        appState.showToast("团队空间：已模拟 3 人协作")
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle("我的")
    }
}

private struct SettingsRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let meta: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            GlassCard {
                HStack(spacing: 12) {
                    Image(systemName: icon)
                        .font(.title3.weight(.bold))
                        .frame(width: 42, height: 42)
                        .background(Color.a12Green.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(Color.a12Green)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title).font(.headline.weight(.bold))
                        Text(subtitle).font(.footnote).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(meta)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
