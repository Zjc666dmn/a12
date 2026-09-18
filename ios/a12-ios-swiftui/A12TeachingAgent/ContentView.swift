import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: A12AppState
    @State private var selectedTab = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                NavigationStack {
                    HomeView()
                        .navigationDestination(isPresented: $appState.showStudio) {
                            StudioView()
                        }
                }
                .tag(0)

                NavigationStack { ProjectsView() }
                    .tag(1)

                NavigationStack { KnowledgeView() }
                    .tag(2)

                NavigationStack { ProfileView() }
                    .tag(3)
            }
            .tint(.a12Green)

            if let toast = appState.toast {
                ToastView(text: toast)
                    .padding(.bottom, 90)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            A12TabBar(selectedTab: $selectedTab)
        }
        .animation(.snappy, value: appState.toast)
        .toolbar(.hidden, for: .tabBar)
        .onChange(of: appState.activeTab) { _, newValue in
            if selectedTab != newValue {
                selectedTab = newValue
            }
        }
        .onChange(of: selectedTab) { _, newValue in
            if appState.activeTab != newValue {
                appState.activeTab = newValue
            }
        }
    }
}

private struct A12TabBar: View {
    @Binding var selectedTab: Int

    private let tabs: [(Int, String, String)] = [
        (0, "首页", "house.fill"),
        (1, "项目", "square.grid.2x2.fill"),
        (2, "知识库", "doc.text.magnifyingglass"),
        (3, "我的", "person.fill")
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs, id: \.0) { tag, title, icon in
                Button {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                        selectedTab = tag
                    }
                    A12Feedback.selection()
                } label: {
                    VStack(spacing: 3) {
                        ZStack {
                            Capsule()
                                .fill(Color.a12Green.opacity(selectedTab == tag ? 0.14 : 0))
                                .frame(width: 42, height: 30)

                            Image(systemName: icon)
                                .font(.system(size: selectedTab == tag ? 21 : 19, weight: .semibold))
                                .foregroundStyle(selectedTab == tag ? Color.a12Green : Color.secondary.opacity(0.65))
                        }
                        .frame(height: 30)

                        Text(title)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(selectedTab == tag ? Color.a12Ink : .secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .accessibilityLabel(title)
                    .accessibilityAddTraits(selectedTab == tag ? [.isSelected] : [])
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .background {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea(.container, edges: .bottom)
        }
        .overlay(alignment: .top) {
            Divider().opacity(0.35)
        }
        .shadow(color: .black.opacity(0.05), radius: 10, y: -3)
    }
}
