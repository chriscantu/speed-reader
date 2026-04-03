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

    /// Default values
    enum Defaults {
        static let wpm = 250
        static let font = "system"
        static let theme = "system"
        static let fontSize = 42
        static let punctuationPause = true
    }

    /// WPM bounds
    static let wpmMin = 100
    static let wpmMax = 600

    /// Font size bounds
    static let fontSizeMin = 28
    static let fontSizeMax = 64
}
