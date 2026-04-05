import SwiftUI

/// Returns a SwiftUI Font for a given ReaderFont at the specified size.
extension ReaderFont {
    func font(size: CGFloat) -> Font {
        switch self {
        case .system: return .system(size: size, weight: .regular)
        case .openDyslexic: return .custom("OpenDyslexic", size: size)
        case .newYork: return .system(size: size, design: .serif)
        case .georgia: return .custom("Georgia", size: size)
        case .menlo: return .custom("Menlo", size: size)
        }
    }
}

/// Small label used for slider min/max value annotations.
private struct SliderBoundLabel: View {
    let value: Int

    var body: some View {
        Text("\(value)")
            .font(.caption2)
            .foregroundStyle(.secondary)
    }
}

/// Matches `--sr-accent: #0891b2` in overlay.css. Update both if the accent color changes.
private let orpAccentColor = Color(red: 8 / 255, green: 145 / 255, blue: 178 / 255)

/// Static preview of a sample word with ORP focus-point highlighting,
/// styled to approximate the RSVP overlay.
private struct RSVPPreview: View {
    let font: ReaderFont
    let fontSize: Int
    let theme: ReaderTheme
    let alignment: ReaderAlignment

    private let word = "knowledge"

    /// ORP focus index: 0 for short words (≤3 chars), floor(length * 0.3) otherwise.
    /// Matches calculateFocusPoint() in focus-point.js.
    private var focusIndex: Int {
        word.count <= 3 ? 0 : Int(floor(Double(word.count) * 0.3))
    }

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
        Group {
            if alignment == .orpAligned {
                HStack(spacing: 0) {
                    Text(before)
                        .foregroundColor(textColor)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    Text(focus)
                        .foregroundColor(orpAccentColor)
                    Text(after)
                        .foregroundColor(textColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .font(font.font(size: CGFloat(fontSize)))
            } else {
                HStack(spacing: 0) {
                    Spacer()
                    (Text(before).foregroundColor(textColor)
                    + Text(focus).foregroundColor(orpAccentColor)
                    + Text(after).foregroundColor(textColor))
                        .font(font.font(size: CGFloat(fontSize)))
                    Spacer()
                }
            }
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
            if !settings.appGroupAvailable {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Settings Sync Unavailable", systemImage: "exclamationmark.triangle.fill")
                            .font(.headline)
                            .foregroundStyle(.orange)
                        Text(
                            "Your settings won't sync with the Safari extension. "
                            + "Try removing and re-enabling the extension in "
                            + "Settings \u{2192} Apps \u{2192} SpeedReader."
                        )
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }

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
                        SliderBoundLabel(value: SettingsKeys.wpmMin)
                    } maximumValueLabel: {
                        SliderBoundLabel(value: SettingsKeys.wpmMax)
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
                RSVPPreview(font: settings.font, fontSize: settings.fontSize, theme: settings.theme, alignment: settings.alignment)
                    .accessibilityHidden(true)

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

                Picker("Word Alignment", selection: Binding(
                    get: { settings.alignment },
                    set: { settings.setAlignment($0) }
                )) {
                    ForEach(ReaderAlignment.allCases) { alignment in
                        Text(alignment.displayName).tag(alignment)
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
                        SliderBoundLabel(value: SettingsKeys.fontSizeMin)
                    } maximumValueLabel: {
                        SliderBoundLabel(value: SettingsKeys.fontSizeMax)
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
