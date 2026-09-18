import SwiftUI

extension Color {
    static let a12Green = Color(red: 0.12, green: 0.54, blue: 1.0)
    static let a12Blue = Color(red: 0.10, green: 0.48, blue: 1.0)
    static let a12Cyan = Color(red: 0.20, green: 0.82, blue: 0.96)
    static let a12Purple = Color(red: 0.58, green: 0.38, blue: 1.0)
    static let a12Ink = Color(red: 0.04, green: 0.13, blue: 0.27)
    static let a12Paper = Color(red: 0.96, green: 0.98, blue: 1.0)
    static let a12Line = Color(red: 0.75, green: 0.84, blue: 0.95)
    static let a12Gradient = LinearGradient(
        colors: [.a12Cyan, .a12Blue, .a12Purple],
        startPoint: .leading,
        endPoint: .trailing
    )
}

extension Animation {
    static let a12Smooth = Animation.spring(response: 0.42, dampingFraction: 0.88, blendDuration: 0.16)
    static let a12Gentle = Animation.easeInOut(duration: 0.34)
}

private struct SmoothScreenTransition: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isVisible = false

    func body(content: Content) -> some View {
        content
            .opacity(reduceMotion || isVisible ? 1 : 0)
            .offset(y: reduceMotion || isVisible ? 0 : 10)
            .scaleEffect(reduceMotion || isVisible ? 1 : 0.992)
            .onAppear {
                if reduceMotion {
                    isVisible = true
                } else {
                    withAnimation(.a12Gentle) { isVisible = true }
                }
            }
    }
}

extension View {
    func smoothScreenTransition() -> some View {
        modifier(SmoothScreenTransition())
    }
}

struct DotGridBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.white, Color(red: 0.92, green: 0.97, blue: 1.0), Color.white],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Circle()
                .fill(Color.a12Cyan.opacity(0.16))
                .frame(width: 260, height: 260)
                .blur(radius: 35)
                .offset(x: 150, y: -290)
            Circle()
                .fill(Color.a12Purple.opacity(0.10))
                .frame(width: 220, height: 220)
                .blur(radius: 45)
                .offset(x: -170, y: 300)
            Canvas { context, size in
                let color = Color.a12Blue.opacity(0.055)
                for x in stride(from: 0, through: size.width, by: 24) {
                    for y in stride(from: 0, through: size.height, by: 24) {
                        context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1.2, height: 1.2)), with: .color(color))
                    }
                }
            }
        }
        .ignoresSafeArea()
    }
}

struct A12Logo: View {
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 10 : 14) {
            ZStack {
                RoundedRectangle(cornerRadius: compact ? 12 : 17)
                    .fill(Color.a12Gradient)
                    .shadow(color: Color.a12Blue.opacity(0.3), radius: 12, y: 6)
                RoundedRectangle(cornerRadius: compact ? 12 : 17)
                    .stroke(.white.opacity(0.8), lineWidth: 1)
                Image(systemName: "book.pages.fill")
                    .font(.system(size: compact ? 17 : 25, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(width: compact ? 40 : 56, height: compact ? 40 : 56)
            VStack(alignment: .leading, spacing: 1) {
                Text("TeachNova")
                    .font(.system(size: compact ? 22 : 34, weight: .black, design: .rounded))
                    .foregroundStyle(Color.a12Ink)
                Text("AI 让教学更简单")
                    .font(.system(size: compact ? 9 : 11, weight: .medium))
                    .tracking(1.8)
                    .foregroundStyle(Color.a12Blue.opacity(0.72))
            }
        }
    }
}

struct ChipButton: View {
    let title: String
    let icon: String?
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon).font(.caption.weight(.bold)) }
                Text(title).font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(active ? .white : Color.a12Ink.opacity(0.58))
            .padding(.horizontal, 17)
            .padding(.vertical, 10)
            .background {
                if active { Capsule().fill(Color.a12Gradient) }
                else { Capsule().fill(.white.opacity(0.76)) }
            }
            .overlay(Capsule().stroke(active ? .white.opacity(0.5) : Color.a12Line.opacity(0.6)))
            .shadow(color: active ? Color.a12Blue.opacity(0.22) : .clear, radius: 10, y: 5)
        }
        .buttonStyle(.plain)
    }
}

struct GlassCard<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        content
            .padding(16)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .background(.white.opacity(0.58), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(LinearGradient(colors: [.white, Color.a12Line.opacity(0.62)], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .shadow(color: Color.a12Ink.opacity(0.065), radius: 20, y: 10)
    }
}

struct GradientActionStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(Color.a12Gradient, in: RoundedRectangle(cornerRadius: 14))
            .shadow(color: Color.a12Blue.opacity(0.24), radius: 12, y: 6)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

struct VoiceInputButton: View {
    @ObservedObject var speech: SpeechRecognitionService
    let sourceText: () -> String
    let onTextChange: (String) -> Void
    let onError: (String) -> Void

    var body: some View {
        Button {
            speech.toggle(baseText: sourceText())
        } label: {
            Label(
                speech.isListening ? "停止听写" : "语音输入",
                systemImage: speech.isListening ? "stop.circle.fill" : "mic.fill"
            )
            .font(.caption.weight(.semibold))
            .foregroundStyle(speech.isListening ? Color.red : Color.a12Blue)
        }
        .buttonStyle(.plain)
        .onChange(of: speech.transcript) { _, newValue in
            onTextChange(newValue)
        }
        .onChange(of: speech.errorMessage) { _, newValue in
            if let newValue { onError(newValue) }
        }
    }
}

struct ToastView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.footnote.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(Color.a12Ink.opacity(0.92), in: Capsule())
            .shadow(color: Color.a12Blue.opacity(0.22), radius: 18, y: 8)
    }
}

struct FeatureTile: View {
    let title: String
    let subtitle: String
    let icon: String
    let colors: [Color]
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
                    Image(systemName: icon).font(.system(size: 20, weight: .bold)).foregroundStyle(.white)
                }
                .frame(width: 46, height: 46)
                .shadow(color: colors.last?.opacity(0.28) ?? .clear, radius: 10, y: 5)
                Text(title).font(.subheadline.weight(.bold)).foregroundStyle(Color.a12Ink).lineLimit(1)
                Text(subtitle).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(.white.opacity(0.78), in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.a12Line.opacity(0.62)))
            .shadow(color: Color.a12Ink.opacity(0.05), radius: 14, y: 8)
        }
        .buttonStyle(.plain)
    }
}

struct ArtifactCard: View {
    let artifact: ProjectArtifact
    let action: () -> Void

    private var accent: [Color] {
        switch artifact.kind {
        case "PPTX": return [.a12Purple.opacity(0.75), .a12Blue]
        case "DOCX": return [.a12Cyan, .a12Blue]
        default: return [Color(red: 0.28, green: 0.88, blue: 0.72), .a12Blue]
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 17)
                        .fill(LinearGradient(colors: accent, startPoint: .topLeading, endPoint: .bottomTrailing))
                    Circle().fill(.white.opacity(0.22)).frame(width: 46).offset(x: 18, y: -20)
                    Image(systemName: artifact.systemImage)
                        .font(.system(size: 27, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .frame(width: 74, height: 74)
                .shadow(color: accent.last?.opacity(0.22) ?? .clear, radius: 12, y: 7)
                VStack(alignment: .leading, spacing: 5) {
                    Text(artifact.title).font(.headline.weight(.bold)).foregroundStyle(Color.a12Ink)
                    Text(artifact.subtitle).font(.caption).foregroundStyle(.secondary)
                    Text(artifact.kind).font(.caption2.weight(.bold)).foregroundStyle(Color.a12Blue)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(Color.a12Blue.opacity(0.6))
            }
            .padding(14)
            .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.a12Line.opacity(0.6)))
            .shadow(color: Color.a12Ink.opacity(0.055), radius: 16, y: 8)
        }
        .buttonStyle(.plain)
    }
}
