import SwiftUI

struct SettingsView: View {
    @Environment(ReaderSettings.self) private var settings

    var body: some View {
        @Bindable var settings = settings

        Form {
            Section("Reading Speed") {
                VStack(alignment: .leading) {
                    Text("\(settings.wpm) WPM")
                        .font(.headline)
                        .monospacedDigit()

                    Slider(
                        value: Binding(
                            get: { Double(settings.wpm) },
                            set: { settings.wpm = Int($0) }
                        ),
                        in: 100...600,
                        step: 25
                    ) {
                        Text("Words per minute")
                    }
                }

                Toggle("Pause on punctuation", isOn: $settings.punctuationPause)
            }

            Section("Appearance") {
                Picker("Font", selection: $settings.font) {
                    ForEach(ReaderFont.allCases) { font in
                        Text(font.displayName).tag(font)
                    }
                }

                Picker("Theme", selection: $settings.theme) {
                    ForEach(ReaderTheme.allCases) { theme in
                        Text(theme.displayName).tag(theme)
                    }
                }

                VStack(alignment: .leading) {
                    Text("Font Size: \(settings.fontSize)px")

                    Slider(
                        value: Binding(
                            get: { Double(settings.fontSize) },
                            set: { settings.fontSize = Int($0) }
                        ),
                        in: 28...64,
                        step: 2
                    ) {
                        Text("Font size")
                    }
                }
            }

            Section("How to Use") {
                Label("Navigate to any article in Safari", systemImage: "safari")
                Label("Tap the SpeedReader icon in the toolbar", systemImage: "hand.tap")
                Label("Tap anywhere to pause, Space on Mac", systemImage: "pause.circle")
                Label("Use ← → to skip between sentences", systemImage: "arrow.left.arrow.right")
            }
        }
        .navigationTitle("SpeedReader")
        #if os(macOS)
        .formStyle(.grouped)
        .frame(minWidth: 400, minHeight: 500)
        #endif
    }
}
