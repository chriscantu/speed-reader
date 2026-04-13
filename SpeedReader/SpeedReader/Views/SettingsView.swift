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

extension ReaderPaper {
    /// Background + text colors for the SwiftUI preview.
    /// MUST match overlay.css `:host([data-paper=...])` color tokens exactly.
    /// Keep in sync with CSS — there is no shared source of truth for these 4 colors.
    var previewColors: (background: Color, text: Color) {
        switch self {
        case .white:
            return (Color(red: 1.0,   green: 1.0,   blue: 1.0),
                    Color(red: 0.2,   green: 0.2,   blue: 0.2))
        case .cream:
            return (Color(red: 0.992, green: 0.965, blue: 0.890),
                    Color(red: 0.361, green: 0.290, blue: 0.165))
        case .slate:
            return (Color(red: 0.165, green: 0.165, blue: 0.165),
                    Color(red: 0.867, green: 0.867, blue: 0.867))
        case .black:
            return (Color(red: 0.0,   green: 0.0,   blue: 0.0),
                    Color(red: 0.878, green: 0.878, blue: 0.878))
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
    let paper: ReaderPaper
    let alignment: ReaderAlignment
    let chunkSize: Int

    private let word = "knowledge"

    /// ORP focus index: 0 for short words (≤3 chars), floor(length * 0.3) otherwise.
    /// Matches calculateFocusPoint() in focus-point.js.
    private var focusIndex: Int {
        word.count <= 3 ? 0 : Int(floor(Double(word.count) * 0.3))
    }

    private var before: String { String(word.prefix(focusIndex)) }
    private var focus: String { String(word[word.index(word.startIndex, offsetBy: focusIndex)]) }
    private var after: String { String(word.suffix(word.count - focusIndex - 1)) }

    private var backgroundColor: Color { paper.previewColors.background }
    private var textColor: Color { paper.previewColors.text }

    // Concatenated Text so minimumScaleFactor applies uniformly to all parts.
    // ORP centering is approximate in this preview — the overlay uses CSS grid
    // for precise focus-letter centering during actual reading.
    private var wordText: Text {
        Text(before).foregroundColor(textColor)
        + Text(focus).foregroundColor(orpAccentColor)
        + Text(after).foregroundColor(textColor)
    }

    var body: some View {
        Group {
            if chunkSize > 1 {
                Text(chunkSize == 2 ? "the quick" : "the quick brown")
                    .foregroundColor(textColor)
                    .font(font.font(size: CGFloat(fontSize)))
                    .lineLimit(1)
                    .minimumScaleFactor(0.3)
                    .frame(maxWidth: .infinity)
            } else {
                wordText
                    .font(font.font(size: CGFloat(fontSize)))
                    .lineLimit(1)
                    .minimumScaleFactor(0.3)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 24)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct SettingsView: View {
    @Environment(ReaderSettings.self) private var settings
    @Environment(OnboardingCoordinator.self) private var coordinator: OnboardingCoordinator?

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

                Picker("Words per flash", selection: Binding(
                    get: { settings.chunkSize },
                    set: { settings.setChunkSize($0) }
                )) {
                    Text("1").tag(1)
                    Text("2").tag(2)
                    Text("3").tag(3)
                }
                .pickerStyle(.segmented)
            } header: {
                Text("Reading Speed")
            } footer: {
                Text("Pauses briefly on periods, commas, and other punctuation for easier comprehension.")
            }

            Section("Appearance") {
                RSVPPreview(
                    font: settings.font,
                    fontSize: settings.fontSize,
                    paper: settings.paper,
                    alignment: settings.alignment,
                    chunkSize: settings.chunkSize
                )
                    .accessibilityHidden(true)

                Picker("Font", selection: Binding(
                    get: { settings.font },
                    set: { settings.setFont($0) }
                )) {
                    ForEach(ReaderFont.allCases) { font in
                        Text(font.displayName).tag(font)
                    }
                }

                Picker("Paper", selection: Binding(
                    get: { settings.paper },
                    set: { settings.setPaper($0) }
                )) {
                    ForEach(ReaderPaper.allCases) { paper in
                        Text(paper.displayName).tag(paper)
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
                Button("How to Use in Safari") {
                    coordinator?.replayWalkthrough()
                }
            }

            #if DEBUG
            Section("Debug: Onboarding Funnel") {
                if let defaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
                    LabeledContent("Phase",
                        value: defaults.string(forKey: SettingsKeys.onboardingPhase) ?? "nil")
                    LabeledContent("Last Step (iOS)",
                        value: "\(defaults.integer(forKey: SettingsKeys.walkthroughLastStepIOS))")
                    LabeledContent("Last Step (macOS)",
                        value: "\(defaults.integer(forKey: SettingsKeys.walkthroughLastStepMacOS))")
                    let completedAt = defaults.double(forKey: SettingsKeys.walkthroughCompletedAt)
                    LabeledContent("Completed",
                        value: completedAt > 0
                            ? Date(timeIntervalSince1970: completedAt).formatted()
                            : "\u{2014}")
                    let activatedAt = defaults.double(forKey: SettingsKeys.firstExtensionActivation)
                    LabeledContent("First Activation",
                        value: activatedAt > 0
                            ? Date(timeIntervalSince1970: activatedAt).formatted()
                            : "\u{2014}")
                    LabeledContent("Replays",
                        value: "\(defaults.integer(forKey: SettingsKeys.walkthroughReplays))")
                }
            }
            #endif
        }
        .navigationTitle("SpeedReader")
        #if os(macOS)
        .formStyle(.grouped)
        .frame(minWidth: 400, minHeight: 500)
        #endif
    }
}
