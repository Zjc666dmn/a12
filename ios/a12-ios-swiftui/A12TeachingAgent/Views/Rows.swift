import SwiftUI

enum DisplayTextFormatter {
    static func plain(_ source: String) -> String {
        var result: [String] = []
        var isInsideCodeBlock = false

        for rawLine in source.components(separatedBy: .newlines) {
            var line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("```") {
                isInsideCodeBlock.toggle()
                continue
            }
            if line.range(of: "^[|: -]+$", options: .regularExpression) != nil { continue }
            line = line.replacingOccurrences(of: "^#{1,6}\\s*", with: "", options: .regularExpression)
            line = line.replacingOccurrences(of: "^>\\s*", with: "", options: .regularExpression)
            line = line.replacingOccurrences(of: "^[-*+]\\s+", with: "• ", options: .regularExpression)
            line = line.replacingOccurrences(of: "**", with: "")
            line = line.replacingOccurrences(of: "__", with: "")
            line = line.replacingOccurrences(of: "`", with: "")
            line = line.replacingOccurrences(of: "|", with: "    ")
            if isInsideCodeBlock { line = "    \(line)" }
            result.append(line)
        }
        return result.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct CreationIcon: View {
    let record: ConversationRecord
    var size: CGFloat = 50

    private var kind: String {
        if let type = record.creationType { return type }
        if record.title.localizedCaseInsensitiveContains("ppt") { return "ppt" }
        if record.title.contains("文档") || record.title.contains("优化") { return "document" }
        if record.title.contains("互动") || record.title.contains("课堂包") { return "game" }
        return "conversation"
    }

    private var icon: String {
        switch kind {
        case "ppt": return "rectangle.on.rectangle.fill"
        case "document": return "doc.text.fill"
        case "game": return "gamecontroller.fill"
        default: return "message.and.waveform.fill"
        }
    }

    private var colors: [Color] {
        switch kind {
        case "ppt": return [.a12Purple, .a12Blue]
        case "document": return [Color.orange.opacity(0.82), .a12Purple]
        case "game": return [Color(red: 0.18, green: 0.80, blue: 0.68), .a12Blue]
        default: return [.a12Cyan, .a12Purple]
        }
    }

    var body: some View {
        Image(systemName: icon)
            .font(.system(size: size * 0.40, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: size * 0.30, style: .continuous))
            .shadow(color: colors.first?.opacity(0.26) ?? .clear, radius: 10, y: 6)
    }
}

struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 52) }
            Text(DisplayTextFormatter.plain(message.text))
                .font(.subheadline)
                .foregroundStyle(message.isUser ? .white : .primary)
                .textSelection(.enabled)
                .padding(13)
                .background(message.isUser ? AnyShapeStyle(Color.a12Gradient) : AnyShapeStyle(Color.white.opacity(0.82)), in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(message.isUser ? Color.white.opacity(0.35) : Color.a12Line.opacity(0.65)))
                .shadow(color: message.isUser ? Color.a12Blue.opacity(0.18) : Color.a12Ink.opacity(0.04), radius: 10, y: 5)
            if !message.isUser { Spacer(minLength: 52) }
        }
    }
}

struct ProgressRow: View {
    let done: Bool
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: done ? "checkmark" : "ellipsis")
                .font(.caption.weight(.bold))
                .foregroundStyle(done ? Color.a12Blue : .orange)
                .frame(width: 28, height: 28)
                .background((done ? Color.a12Blue : Color.orange).opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.bold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

struct OutlineRow: View {
    let number: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 10) {
            Text(number)
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.a12Blue)
                .frame(width: 34, height: 34)
                .background(Color.a12Blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.bold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

struct FileRow: View {
    let kind: String
    let color: Color
    let title: String
    let subtitle: String
    let meta: String

    var body: some View {
        HStack(spacing: 10) {
            Text(kind)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 42, height: 42)
                .background(color, in: RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.bold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(meta).font(.caption).foregroundStyle(.secondary)
        }
        .padding(13)
        .background(.white.opacity(0.78), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.a12Line.opacity(0.62)))
        .shadow(color: Color.a12Ink.opacity(0.04), radius: 12, y: 6)
    }
}
