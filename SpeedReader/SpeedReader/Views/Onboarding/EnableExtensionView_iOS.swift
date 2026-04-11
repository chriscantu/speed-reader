#if os(iOS)
import SwiftUI

/// Phase 1 onboarding for iOS: guide user to enable the Safari extension in Settings.
struct EnableExtensionView_iOS: View {
    var onComplete: () -> Void

    @State private var settingsErrorMessage: String?

    private let instructions = [
        "Tap \"Open Settings\" below",
        "Tap \u{2190} Back to return to Settings",
        "Tap Apps \u{2192} Safari \u{2192} Extensions",
        "Turn on SpeedReader",
        "Set to \"Allow\" on all websites",
    ]

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "book.pages")
                .font(.system(size: 64))
                .foregroundStyle(Color.accentColor)

            Text("SpeedReader")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Speed read any web page with Rapid Serial Visual Presentation")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 16) {
                ForEach(Array(instructions.enumerated()), id: \.offset) { index, text in
                    instructionRow(number: index + 1, text: text)
                }
            }
            .padding(24)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 24)

            Button("Open Settings App") {
                openSettings()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Text("This opens SpeedReader settings \u{2014} tap \u{2190} Back\nto reach Safari extensions.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("Done \u{2014} show me how to use it") {
                onComplete()
            }
            .foregroundStyle(.secondary)

            Spacer()
        }
        .alert("Unable to Open Settings", isPresented: Binding(
            get: { settingsErrorMessage != nil },
            set: { if !$0 { settingsErrorMessage = nil } }
        )) {
            Button("OK") { settingsErrorMessage = nil }
        } message: {
            if let msg = settingsErrorMessage { Text(msg) }
        }
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            settingsErrorMessage = "Could not build Settings URL. "
                + "Please open Settings manually: Apps \u{2192} Safari \u{2192} Extensions."
            return
        }
        UIApplication.shared.open(url) { success in
            if !success {
                DispatchQueue.main.async {
                    settingsErrorMessage = "Could not open Settings. "
                        + "Please navigate manually: Settings \u{2192} Apps \u{2192} Safari \u{2192} Extensions."
                }
            }
        }
    }

    private func instructionRow(number: Int, text: String) -> some View {
        HStack(spacing: 12) {
            Text("\(number)")
                .font(.caption)
                .fontWeight(.bold)
                .frame(width: 24, height: 24)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(Circle())

            Text(text)
                .font(.body)
        }
    }
}
#endif
