import SwiftUI

/// Simplified RSVP overlay preview for the walkthrough's "Start Reading" step.
/// Shows a sample word with ORP highlighting and basic controls.
struct RSVPOverlayPreview: View {
    /// Whether to show keyboard shortcut hints (macOS) or tap hints (iOS).
    var showKeyboardHints: Bool = false

    /// Matches `--sr-accent: #0891b2` in overlay.css.
    private let accentColor = Color(red: 8 / 255, green: 145 / 255, blue: 178 / 255)

    var body: some View {
        VStack(spacing: 16) {
            // Context line
            Text("The quick brown fox jumps over the lazy dog")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.3))

            // Word with ORP
            HStack(spacing: 0) {
                Text("qu")
                    .foregroundStyle(.white.opacity(0.7))
                Text("i")
                    .foregroundStyle(accentColor)
                Text("ck")
                    .foregroundStyle(.white.opacity(0.7))
            }
            .font(.system(size: 32, weight: .light))

            // Controls
            HStack(spacing: 20) {
                controlButton(systemName: "chevron.left")
                controlButton(systemName: "play.fill", accent: true)
                controlButton(systemName: "chevron.right")
            }

            // Hint text
            if showKeyboardHints {
                Text("Space to pause \u{00B7} \u{2190} \u{2192} to navigate")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
            } else {
                Text("Tap anywhere to pause")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Color.black)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Speed reader preview showing the word quick with focus-point highlighting")
    }

    private func controlButton(systemName: String, accent: Bool = false) -> some View {
        Image(systemName: systemName)
            .font(.caption)
            .foregroundStyle(accent ? accentColor : .white.opacity(0.4))
            .frame(width: 32, height: 32)
            .overlay(
                Circle()
                    .strokeBorder(accent ? accentColor : .white.opacity(0.3), lineWidth: 1.5)
            )
    }
}
