#if os(macOS)
import SwiftUI
import SafariServices

/// Phase 1 onboarding for macOS: guide user to enable the Safari extension.
struct EnableExtensionView_macOS: View {
    var onComplete: () -> Void

    @State private var settingsErrorMessage: String?

    private let instructions = [
        "Click Safari \u{2192} Settings",
        "Click Extensions",
        "Enable SpeedReader",
        "Allow on all websites",
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

            Button("Open Safari Settings") {
                openSafariSettings()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

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

    private func openSafariSettings() {
        SFSafariApplication.showPreferencesForExtension(
            withIdentifier: SettingsKeys.extensionBundleIdentifier
        ) { error in
            if let error {
                DispatchQueue.main.async {
                    settingsErrorMessage = "Could not open Safari settings: \(error.localizedDescription)"
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
