import SwiftUI
import UIKit

extension Color {
    static let a12Green = Color(red: 0.17, green: 0.48, blue: 0.13)
    static let a12GreenDark = Color(red: 0.13, green: 0.38, blue: 0.10)
    static let a12Ink = Color(red: 0.07, green: 0.08, blue: 0.09)
    static let a12Text = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark ? .white : .black
    })
    static let a12Paper = Color(red: 0.98, green: 0.98, blue: 0.96)
    static let a12PaperGradient = LinearGradient(
        colors: [Color(red: 0.99, green: 0.99, blue: 0.97), Color(red: 0.95, green: 0.97, blue: 0.94)],
        startPoint: .top, endPoint: .bottom
    )
    static let a12GreenGradient = LinearGradient(
        colors: [Color.a12Green, Color.a12GreenDark],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    static let a12GlassFill = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.07)
            : UIColor(white: 1.0, alpha: 0.32)
    })
    static let a12GlassFillStrong = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.11)
            : UIColor(white: 1.0, alpha: 0.46)
    })
    static let a12IconTile = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(white: 0.15, alpha: 0.96)
            : UIColor(white: 1.0, alpha: 0.92)
    })
    static let a12Chrome = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(white: 0.08, alpha: 0.72)
            : UIColor(white: 1.0, alpha: 0.70)
    })
    static let a12ToastBackground = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(white: 0.15, alpha: 0.96)
            : UIColor(white: 0.07, alpha: 0.94)
    })
    static let a12Separator = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.12)
            : UIColor.black.withAlphaComponent(0.09)
    })
    static let a12CardStroke = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.16)
            : UIColor.black.withAlphaComponent(0.10)
    })
}

@MainActor
enum A12Feedback {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

struct StaggeredAppear: ViewModifier {
    let index: Int
    @State private var isVisible = false

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 14)
            .scaleEffect(isVisible ? 1 : 0.98)
            .onAppear {
                guard !isVisible else { return }
                withAnimation(.spring(response: 0.5, dampingFraction: 0.85).delay(Double(index) * 0.07)) {
                    isVisible = true
                }
            }
    }
}

extension View {
    func staggeredAppear(index: Int) -> some View {
        modifier(StaggeredAppear(index: index))
    }
}

struct DotGridBackground: View {
    var body: some View {
        Canvas { context, size in
            let color = Color.primary.opacity(0.045)
            for x in stride(from: 0, through: size.width, by: 18) {
                for y in stride(from: 0, through: size.height, by: 18) {
                    context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1.2, height: 1.2)), with: .color(color))
                }
            }
        }
        .background(Color.a12PaperGradient)
        .ignoresSafeArea()
    }
}

/// 模拟温室漫射自然光的氛围背景：柔和米白渐变 + 多层模糊光晕 + 植物剪影
struct AmbientBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ZStack {
            // 基底渐变
            LinearGradient(
                colors: colorScheme == .dark ? [
                    Color(red: 0.05, green: 0.07, blue: 0.06),
                    Color(red: 0.04, green: 0.05, blue: 0.05),
                    Color(red: 0.03, green: 0.04, blue: 0.04)
                ] : [
                    Color(red: 0.98, green: 0.98, blue: 0.95),
                    Color(red: 0.92, green: 0.95, blue: 0.91),
                    Color(red: 0.86, green: 0.91, blue: 0.88)
                ],
                startPoint: .top, endPoint: .bottom
            )

            // 顶部暖白光晕（模拟天窗射入）
            RadialGradient(
                colors: [Color.white.opacity(colorScheme == .dark ? 0.12 : 0.95), Color.white.opacity(0)],
                center: UnitPoint(x: 0.5, y: -0.1), startRadius: 10, endRadius: 420
            )
            .blendMode(.screen)

            // 左侧绿色光晕
            RadialGradient(
                colors: [Color(red: 0.45, green: 0.70, blue: 0.45).opacity(colorScheme == .dark ? 0.20 : 0.30), .clear],
                center: UnitPoint(x: -0.1, y: 0.4), startRadius: 20, endRadius: 320
            )
            .blendMode(.multiply)

            // 右侧青绿光晕
            RadialGradient(
                colors: [Color(red: 0.55, green: 0.75, blue: 0.65).opacity(colorScheme == .dark ? 0.16 : 0.25), .clear],
                center: UnitPoint(x: 1.1, y: 0.6), startRadius: 20, endRadius: 340
            )
            .blendMode(.multiply)

            // 底部暖色光晕
            RadialGradient(
                colors: [Color(red: 0.96, green: 0.90, blue: 0.80).opacity(colorScheme == .dark ? 0.08 : 0.30), .clear],
                center: .bottom, startRadius: 20, endRadius: 380
            )
            .blendMode(.screen)

            // 全局柔光叠加
            LinearGradient(
                colors: [.clear, Color.white.opacity(colorScheme == .dark ? 0.05 : 0.15), .clear],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .blendMode(.overlay)
        }
        .ignoresSafeArea()
    }
}

struct A12Logo: View {
    var compact = false
    @State private var breathing = false

    var body: some View {
        HStack(spacing: compact ? 8 : 12) {
            ZStack {
                RoundedRectangle(cornerRadius: compact ? 12 : 16)
                    .stroke(Color.a12Ink, lineWidth: compact ? 1.6 : 2.4)
                    .background(Color.a12IconTile, in: RoundedRectangle(cornerRadius: compact ? 12 : 16))
                Image(systemName: "location.north.fill")
                    .font(.system(size: compact ? 16 : 24, weight: .bold))
                    .foregroundStyle(Color.a12Ink)
                    .scaleEffect(breathing ? 1.06 : 1.0)
                    .animation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true), value: breathing)
            }
            .frame(width: compact ? 36 : 52, height: compact ? 36 : 52)
            .onAppear { breathing = true }

            VStack(alignment: .leading, spacing: 2) {
                Text("A12 Studio")
                    .font(.system(size: compact ? 24 : 38, weight: .black, design: .rounded))
                    .foregroundStyle(Color.a12Ink)
                if !compact {
                    Text("让每一节课都更生动")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct ChipButton: View {
    let title: String
    let icon: String?
    let active: Bool
    let action: () -> Void
    @State private var pressed = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon {
                    Image(systemName: icon)
                        .font(.caption.weight(.bold))
                }
                Text(title)
                    .font(.subheadline.weight(.bold))
            }
            .foregroundStyle(active ? .white : .secondary)
            .padding(.horizontal, 16)
            .padding(.vertical, 11)
            .background(
                Capsule()
                    .fill(active ? AnyShapeStyle(Color.a12GreenGradient) : AnyShapeStyle(Color.a12IconTile))
            )
            .overlay(Capsule().stroke(active ? Color.a12GreenDark.opacity(0.5) : Color.a12Separator))
            .shadow(color: active ? Color.a12Green.opacity(0.2) : .black.opacity(0.03), radius: active ? 8 : 6, y: active ? 4 : 3)
            .scaleEffect(pressed ? 0.94 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: pressed)
            .animation(.easeInOut(duration: 0.2), value: active)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded { _ in pressed = false }
        )
    }
}

struct GlassCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(18)
            .background(Color.a12GlassFill, in: RoundedRectangle(cornerRadius: 22))
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22))
            .overlay {
                RoundedRectangle(cornerRadius: 22)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.7), Color.white.opacity(0.2)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            }
            .overlay {
                RoundedRectangle(cornerRadius: 22)
                    .stroke(Color.a12Separator, lineWidth: 0.5)
            }
            .shadow(color: .black.opacity(0.02), radius: 4, y: 1)
            .shadow(color: .black.opacity(0.05), radius: 16, y: 8)
    }
}

struct ToastView: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.footnote.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.a12ToastBackground, in: Capsule())
            .shadow(color: .black.opacity(0.14), radius: 12, y: 5)
    }
}

struct ArtifactCard: View {
    let artifact: ProjectArtifact
    let action: () -> Void
    @State private var pressed = false

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                ZStack {
                    Color.a12IconTile
                    Image(systemName: artifact.systemImage)
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(Color.a12Green)
                }
                .frame(height: 120)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.a12Separator, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 3) {
                    Text(artifact.title)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color.a12Ink)
                    Text(artifact.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 2)
            }
            .padding(10)
            .background(Color.a12GlassFillStrong, in: RoundedRectangle(cornerRadius: 18))
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
            .overlay {
                RoundedRectangle(cornerRadius: 18)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.7), Color.white.opacity(0.22)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            }
            .shadow(color: .black.opacity(0.03), radius: 4, y: 1)
            .shadow(color: .black.opacity(0.07), radius: 14, y: 7)
            .scaleEffect(pressed ? 0.97 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.65), value: pressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded { _ in pressed = false }
        )
    }
}
