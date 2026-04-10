import SwiftUI
#if os(macOS)
import SafariServices
#endif

/// Describes the action performed by the settings button.
enum SettingsAction: Equatable {
    #if os(macOS)
    /// Open Safari extension preferences.
    case openSafariExtensionPreferences
    #else
    /// Navigate to the system Settings app.
    case openSystemSettings
    #endif
}

/// Platform-specific onboarding content, extracted for testability.
struct OnboardingContent {
    let instructions: [String]
    let buttonTitle: String
    let helperText: String?
    let settingsAction: SettingsAction

    init(instructions: [String], buttonTitle: String, helperText: String?, settingsAction: SettingsAction) {
        precondition(!instructions.isEmpty, "Onboarding must have at least one instruction")
        precondition(!buttonTitle.isEmpty, "Button title must not be empty")
        self.instructions = instructions
        self.buttonTitle = buttonTitle
        self.helperText = helperText
        self.settingsAction = settingsAction
    }

    static let current: OnboardingContent = {
        #if os(macOS)
        return OnboardingContent(
            instructions: [
                "Click Safari → Settings",
                "Click Extensions",
                "Enable SpeedReader",
                "Allow on all websites"
            ],
            buttonTitle: "Open Safari Settings",
            helperText: nil,
            settingsAction: .openSafariExtensionPreferences
        )
        #else
        return OnboardingContent(
            instructions: [
                "Tap \"Open Settings\" below",
                "Tap ← Back to return to Settings",
                "Tap Apps → Safari → Extensions",
                "Turn on SpeedReader",
                "Set to \"Allow\" on all websites"
            ],
            buttonTitle: "Open Settings App",
            helperText: "This opens SpeedReader settings — tap ← Back\nto reach Safari extensions.",
            settingsAction: .openSystemSettings
        )
        #endif
    }()
}

struct OnboardingView: View {
    var onComplete: () -> Void

    private let content = OnboardingContent.current
    @State private var settingsErrorMessage: String?

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
                performSettingsAction(content.settingsAction)
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
        .alert("Unable to Open Settings", isPresented: Binding(
            get: { settingsErrorMessage != nil },
            set: { if !$0 { settingsErrorMessage = nil } }
        )) {
            Button("OK") { settingsErrorMessage = nil }
        } message: {
            if let msg = settingsErrorMessage {
                Text(msg)
            }
        }
    }

    private func performSettingsAction(_ action: SettingsAction) {
        switch action {
        #if os(macOS)
        case .openSafariExtensionPreferences:
            SFSafariApplication.showPreferencesForExtension(
                withIdentifier: SettingsKeys.extensionBundleIdentifier
            ) { error in
                if let error {
                    DispatchQueue.main.async {
                        settingsErrorMessage = "Could not open Safari settings: \(error.localizedDescription)"
                    }
                }
            }
        #else
        case .openSystemSettings:
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                settingsErrorMessage = "Could not build Settings URL. "
                    + "Please open Settings manually: Apps → Safari → Extensions."
                return
            }
            UIApplication.shared.open(url) { success in
                if !success {
                    DispatchQueue.main.async {
                        settingsErrorMessage = "Could not open Settings. "
                            + "Please navigate manually: Settings → Apps → Safari → Extensions."
                    }
                }
            }
        #endif
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
