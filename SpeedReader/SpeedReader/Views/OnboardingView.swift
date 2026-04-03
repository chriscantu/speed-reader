import SwiftUI
#if os(macOS)
import SafariServices
#endif

struct OnboardingView: View {
    @Binding var extensionEnabled: Bool
    @Binding var hasChecked: Bool

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
                instructionRow(number: 1, text: "Open Safari Settings")
                instructionRow(number: 2, text: "Tap Extensions")
                instructionRow(number: 3, text: "Enable SpeedReader")
                instructionRow(number: 4, text: "Allow on all websites")
            }
            .padding(24)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 24)

            #if os(macOS)
            Button("Open Safari Settings") {
                SFSafariApplication.showPreferencesForExtension(
                    withIdentifier: "com.chriscantu.SpeedReader.SpeedReaderExtension"
                ) { error in
                    if let error {
                        print("[SpeedReader] Could not open settings: \(error)")
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            #else
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            #endif

            Button("I've enabled it") {
                checkExtensionStatus()
            }
            .foregroundStyle(.secondary)

            Spacer()
        }
        .onAppear {
            checkExtensionStatus()
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

    private func checkExtensionStatus() {
        #if os(macOS)
        SFSafariExtensionManager.getStateOfSafariExtension(
            withIdentifier: "com.chriscantu.SpeedReader.SpeedReaderExtension"
        ) { state, _ in
            DispatchQueue.main.async {
                hasChecked = true
                extensionEnabled = state?.isEnabled ?? false
            }
        }
        #else
        // iOS doesn't have a programmatic way to check extension state.
        // After user taps "I've enabled it", trust them and show settings.
        hasChecked = true
        extensionEnabled = true
        #endif
    }
}
