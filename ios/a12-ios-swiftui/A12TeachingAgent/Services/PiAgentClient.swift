import Foundation

struct PiAgentClient {
    var baseURL: URL?

    func createTeachingTask(prompt: String, artifact: ArtifactType) async throws -> String {
        // Replace this mock with the real Pi Agent task creation API.
        try await Task.sleep(nanoseconds: 350_000_000)
        return "mock-task-\(artifact.id)"
    }

    func streamTaskStatus(taskID: String) -> AsyncStream<String> {
        AsyncStream { continuation in
            continuation.yield("需求结构化完成")
            continuation.yield("RAG 检索完成")
            continuation.yield("课件与教案生成完成")
            continuation.finish()
        }
    }
}
