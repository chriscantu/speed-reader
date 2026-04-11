import SwiftUI

/// Stylized macOS Safari toolbar showing the extensions area.
/// Used in the Phase 2 macOS walkthrough.
struct SafariToolbar: View {
    @State private var isPulsing = false

    var body: some View {
        VStack(spacing: 0) {
            // Traffic lights
            HStack(spacing: 6) {
                Circle().fill(.red.opacity(0.8)).frame(width: 12, height: 12)
                Circle().fill(.yellow.opacity(0.8)).frame(width: 12, height: 12)
                Circle().fill(.green.opacity(0.8)).frame(width: 12, height: 12)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 4)

            // Toolbar row
            HStack(spacing: 8) {
                // Nav buttons
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                        .foregroundStyle(.tertiary)
                    Image(systemName: "chevron.right")
                        .foregroundStyle(.tertiary)
                }
                .font(.caption)

                // Address bar
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text("example.com")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .padding(.horizontal, 10)
                .background(.quaternary)
                .clipShape(RoundedRectangle(cornerRadius: 6))

                // Extension icons area
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(.quaternary)
                        .frame(width: 20, height: 20)
                        .opacity(0.4)

                    // SpeedReader icon highlighted
                    Image("AppIcon-Small")
                        .resizable()
                        .frame(width: 20, height: 20)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .shadow(color: Color.accentColor.opacity(isPulsing ? 0.5 : 0),
                                radius: isPulsing ? 6 : 0)
                        .onAppear {
                            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                                isPulsing = true
                            }
                        }

                    RoundedRectangle(cornerRadius: 4)
                        .fill(.quaternary)
                        .frame(width: 20, height: 20)
                        .opacity(0.4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .background(Color(white: 0.93))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Safari toolbar. Click the SpeedReader icon in the extensions area.")
    }
}
