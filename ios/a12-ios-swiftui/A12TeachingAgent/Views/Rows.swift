import SwiftUI

struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 52) }
            Text(message.text)
                .font(.subheadline)
                .foregroundStyle(message.isUser ? .white : .primary)
                .padding(13)
                .background(message.isUser ? Color.a12Ink : Color.a12IconTile, in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(message.isUser ? Color.clear : Color.a12Separator))
            if !message.isUser { Spacer(minLength: 52) }
        }
    }
}

struct ProgressRow: View {
    let done: Bool
    let title: String
    let subtitle: String
    var meta = ""

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: done ? "checkmark" : "ellipsis")
                .font(.caption.weight(.bold))
                .foregroundStyle(done ? Color.a12Green : Color.a12GreenDark)
                .frame(width: 28, height: 28)
                .background((done ? Color.a12Green : Color.a12GreenDark).opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.bold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if !meta.isEmpty {
                Text(meta)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
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
                .foregroundStyle(Color.a12Green)
                .frame(width: 34, height: 34)
                .background(Color.a12Green.opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
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
        .background(Color.a12IconTile, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.a12Separator))
    }
}
