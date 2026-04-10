import SwiftUI
#if os(macOS)
import SafariServices
#endif

/// Platform-specific onboarding content, extracted for testability.
struct OnboardingContent {
    let instructions: [String]
    let buttonTitle: String
    let helperText: String?

    static let current: OnboardingContent = {
        #if os(macOS)
        return OnboardingContent(
            instructions: [
                "Open Safari Settings",
                "Tap Extensions",
                "Enable SpeedReader",
                "Allow on all websites",
            ],
            buttonTitle: "Open Safari Settings",
            helperText: nil
        )
        #else
        return OnboardingContent(
            instructions: [
                "Tap \"Open Settings\" below",
                "Tap ← Back to return to Settings",
                "Tap Apps → Safari → Extensions",
                "Turn on SpeedReader",
                "Set to \"Allow\" on all websites",
            ],
            buttonTitle: "Open Settings App",
            helperText: "This opens SpeedReader settings — tap ← Back\nto reach Safari extensions."
        )
        #endif
    }()
}

struct OnboardingView: View {
    var onComplete: () -> Void

    private let content = OnboardingContent.current

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
                ForEach(Array(content.instructions.enumerated()), id: \.offset) { index, text in
                    instructionRow(number: index + 1, text: text)
                }
            }
            .padding(24)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 24)

            Button(content.buttonTitle) {
                #if os(macOS)
                SFSafariApplication.showPreferencesForExtension(
                    withIdentifier: "com.chriscantu.SpeedReader.SpeedReaderExtension"
                ) { error in
                    if let error {
                        print("[SpeedReader] Could not open settings: \(error)")
                    }
                }
                #else
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
                #endif
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            if let helperText = content.helperText {
                Text(helperText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button("I've enabled it") {
                onComplete()
            }
            .foregroundStyle(.secondary)

            Spacer()
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
