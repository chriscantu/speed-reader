import Foundation

/// Constants for App Group settings shared between the app and extension.
enum SettingsKeys {
    /// App Group identifier — must match the entitlements file.
    static let appGroupID = "group.com.speedreader.shared"

    static let wpm = "sr_wpm"
    static let font = "sr_font"
    static let theme = "sr_theme"
    static let fontSize = "sr_fontSize"
    static let punctuationPause = "sr_punctuationPause"

    /// Default values — use typed enum cases to prevent drift from raw values.
    enum Defaults {
        static let wpm = 250
        static let font: ReaderFont = .system
        static let theme: ReaderTheme = .system
        static let fontSize = 42
        static let punctuationPause = true
    }

    /// WPM bounds
    static let wpmMin = 100
    static let wpmMax = 600

    /// WPM range for sliders
    static let wpmRange = Double(wpmMin)...Double(wpmMax)

    /// Font size bounds
    static let fontSizeMin = 28
    static let fontSizeMax = 64

    /// Font size range for sliders
    static let fontSizeRange = Double(fontSizeMin)...Double(fontSizeMax)

    /// Clamp an integer to a range.
    static func clamp(_ value: Int, min: Int, max: Int) -> Int {
        Swift.max(min, Swift.min(max, value))
    }
}
