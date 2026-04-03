import SwiftUI

/// Live preview of a single word with ORP focus-point highlighting,
/// matching the RSVP overlay experience.
private struct RSVPPreview: View {
    let font: ReaderFont
    let fontSize: Int
    let theme: ReaderTheme

    private let word = "knowledge"

    /// ORP: for words > 3 chars, focus index is floor(length * 0.3).
    private var focusIndex: Int { Int(floor(Double(word.count) * 0.3)) }

    private var before: String { String(word.prefix(focusIndex)) }
    private var focus: String { String(word[word.index(word.startIndex, offsetBy: focusIndex)]) }
    private var after: String { String(word.suffix(word.count - focusIndex - 1)) }

    private var backgroundColor: Color {
        switch theme {
        case .dark: return Color.black
        case .light: return Color.white
        case .system:
            #if os(macOS)
            return Color(nsColor: .windowBackgroundColor)
            #else
            return Color(uiColor: .systemBackground)
            #endif
        }
    }

    private var textColor: Color {
        switch theme {
        case .dark: return Color.white
        case .light: return Color.black
        case .system: return Color.primary
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            Spacer()
            (Text(before).foregroundColor(textColor)
            + Text(focus).foregroundColor(.red)
            + Text(after).foregroundColor(textColor))
                .font(font.font(size: CGFloat(fontSize)))
            Spacer()
        }
        .padding(.vertical, 24)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct SettingsView: View {
    @Environment(ReaderSettings.self) private var settings

    var body: some View {
        Form {
            Section {
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
                    } minimumValueLabel: {
                        Text("\(SettingsKeys.wpmMin)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    } maximumValueLabel: {
                        Text("\(SettingsKeys.wpmMax)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                Toggle("Pause on punctuation", isOn: Binding(
                    get: { settings.punctuationPause },
                    set: { settings.setPunctuationPause($0) }
                ))
            } header: {
                Text("Reading Speed")
            } footer: {
                Text("Pauses briefly on periods, commas, and other punctuation for easier comprehension.")
            }

            Section("Appearance") {
                RSVPPreview(font: settings.font, fontSize: settings.fontSize, theme: settings.theme)

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
                    } minimumValueLabel: {
                        Text("\(SettingsKeys.fontSizeMin)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    } maximumValueLabel: {
                        Text("\(SettingsKeys.fontSizeMax)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Section {
                DisclosureGroup("How to Use") {
                    Label("Navigate to any article in Safari", systemImage: "safari")
                    Label("Tap the SpeedReader icon in the toolbar", systemImage: "hand.tap")
                    Label("Tap anywhere to pause, Space on Mac", systemImage: "pause.circle")
                    Label("Use ← → to skip between sentences", systemImage: "arrow.left.arrow.right")
                }
            }
        }
        .navigationTitle("SpeedReader")
        #if os(macOS)
        .formStyle(.grouped)
        .frame(minWidth: 400, minHeight: 500)
        #endif
    }
}
