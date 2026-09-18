import SwiftUI

@main
struct A12TeachingAgentApp: App {
    @StateObject private var appState = A12AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}
