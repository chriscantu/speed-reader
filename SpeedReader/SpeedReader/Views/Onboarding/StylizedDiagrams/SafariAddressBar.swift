import SwiftUI

/// Stylized Safari address bar with a pulsing puzzle piece extension icon.
/// Used in the Phase 2 walkthrough to show where to find extensions.
struct SafariAddressBar: View {
    @State private var isPulsing = false

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "lock.fill")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text("example.com")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            Image(systemName: "puzzlepiece.extension")
                .font(.title3)
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(Color.accentColor)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .shadow(color: Color.accentColor.opacity(isPulsing ? 0.5 : 0),
                        radius: isPulsing ? 8 : 0)
                .onAppear {
                    withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                        isPulsing = true
                    }
                }
        }
        .padding(12)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Safari address bar. Tap the puzzle piece icon to open extensions.")
    }
}
