import SwiftUI
#if os(macOS)
import SafariServices
#endif

struct OnboardingView: View {
    var onComplete: () -> Void

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
                #if os(macOS)
                instructionRow(number: 1, text: "Open Safari Settings")
                instructionRow(number: 2, text: "Tap Extensions")
                instructionRow(number: 3, text: "Enable SpeedReader")
                instructionRow(number: 4, text: "Allow on all websites")
                #else
                instructionRow(number: 1, text: "Open Settings app")
                instructionRow(number: 2, text: "Go to Apps → Safari → Extensions")
                instructionRow(number: 3, text: "Enable SpeedReader")
                instructionRow(number: 4, text: "Set to \"Allow\" on all websites")
                #endif
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
            Button("Open Settings App") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Text("Then navigate to Apps → Safari → Extensions")
                .font(.caption)
                .foregroundStyle(.secondary)
            #endif

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
