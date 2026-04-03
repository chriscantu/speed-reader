import SwiftUI

struct SettingsView: View {
    @Environment(ReaderSettings.self) private var settings

    var body: some View {
        Form {
            Section("Reading Speed") {
                VStack(alignment: .leading) {
                    Text("\(settings.wpm) WPM")
                        .font(.headline)
                        .monospacedDigit()

                    Slider(
                        value: Binding(
                            get: { Double(settings.wpm) },
                            set: { settings.setWpm(Int($0)) }
                        ),
                        in: SettingsKeys.wpmRange,
                        step: 25
                    ) {
                        Text("Words per minute")
                    }
                }

                Toggle("Pause on punctuation", isOn: Binding(
                    get: { settings.punctuationPause },
                    set: { settings.setPunctuationPause($0) }
                ))
            }

            Section("Appearance") {
                Picker("Font", selection: Binding(
                    get: { settings.font },
                    set: { settings.setFont($0) }
                )) {
                    ForEach(ReaderFont.allCases) { font in
                        Text(font.displayName).tag(font)
                    }
                }

                Picker("Theme", selection: Binding(
                    get: { settings.theme },
                    set: { settings.setTheme($0) }
                )) {
                    ForEach(ReaderTheme.allCases) { theme in
                        Text(theme.displayName).tag(theme)
                    }
                }

                VStack(alignment: .leading) {
                    Text("Font Size: \(settings.fontSize)px")

                    Slider(
                        value: Binding(
                            get: { Double(settings.fontSize) },
                            set: { settings.setFontSize(Int($0)) }
                        ),
                        in: SettingsKeys.fontSizeRange,
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
