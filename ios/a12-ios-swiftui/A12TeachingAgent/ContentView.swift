import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: A12AppState

    private let tabs: [(title: String, icon: String)] = [
        ("首页", "house.fill"),
        ("项目", "square.grid.2x2.fill"),
        ("知识库", "doc.text.magnifyingglass"),
        ("我的", "person.fill")
    ]

    var body: some View {
        ZStack(alignment: .bottom) {
            ZStack {
                selectedTabView
                    .id(appState.activeTab)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .move(edge: .trailing)),
                        removal: .opacity.combined(with: .move(edge: .leading))
                    ))
            }
            .animation(.a12Smooth, value: appState.activeTab)

            if let toast = appState.toast {
                ToastView(text: toast)
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            customTabBar
                .background(
                    Color(red: 0.965, green: 0.98, blue: 1.0)
                        .ignoresSafeArea(edges: .bottom)
                )
        }
        .animation(.a12Smooth, value: appState.toast)
        .animation(.a12Smooth, value: appState.activeTab)
        .sheet(isPresented: $appState.showRecentCreations) {
            RecentCreationsView()
                .environmentObject(appState)
                .presentationDetents([.large])
                .presentationCornerRadius(28)
        }
    }

    private var customTabBar: some View {
        HStack(spacing: 6) {
            ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                Button {
                    animatedTab.wrappedValue = index
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 18, weight: .semibold))
                            .symbolEffect(.bounce, value: appState.activeTab == index)
                        Text(tab.title)
                            .font(.caption2.weight(.semibold))
                    }
                    .foregroundStyle(appState.activeTab == index ? .white : Color.a12Ink.opacity(0.48))
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background {
                        if appState.activeTab == index {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(Color.a12Gradient)
                                .shadow(color: Color.a12Blue.opacity(0.28), radius: 12, y: 6)
                                .matchedGeometryEffect(id: "activeTab", in: tabNamespace)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.title)
                .accessibilityAddTraits(appState.activeTab == index ? .isSelected : [])
            }
        }
        .padding(7)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 25, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 25, style: .continuous)
                .stroke(LinearGradient(colors: [.white, Color.a12Line.opacity(0.85)], startPoint: .top, endPoint: .bottom))
        )
        .shadow(color: Color.a12Ink.opacity(0.12), radius: 20, y: 8)
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 6)
    }

    @ViewBuilder
    private var selectedTabView: some View {
        switch appState.activeTab {
        case 1:
            NavigationStack { ProjectsView() }
        case 2:
            NavigationStack { KnowledgeView() }
        case 3:
            NavigationStack { ProfileView() }
        default:
            NavigationStack {
                HomeView()
                    .navigationDestination(isPresented: $appState.showStudio) {
                        StudioView()
                            .id(appState.conversationID)
                    }
                    .navigationDestination(isPresented: $appState.showDocumentOptimizer) {
                        DocumentOptimizerView()
                    }
                    .navigationDestination(isPresented: $appState.showPPTGenerator) {
                        PPTGeneratorView()
                    }
                    .navigationDestination(isPresented: $appState.showInteractiveClassroom) {
                        InteractiveClassroomView()
                    }
            }
        }
    }

    @Namespace private var tabNamespace

    private var animatedTab: Binding<Int> {
        Binding(
            get: { appState.activeTab },
            set: { newValue in
                withAnimation(.a12Smooth) { appState.activeTab = newValue }
            }
        )
    }
}
