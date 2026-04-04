import Foundation
import os.log

/// Font options for the RSVP reader.
enum ReaderFont: String, CaseIterable, Identifiable {
    case system = "system"
    case openDyslexic = "opendyslexic"
    case newYork = "newYork"
    case georgia = "georgia"
    case menlo = "menlo"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System (San Francisco)"
        case .openDyslexic: return "OpenDyslexic"
        case .newYork: return "New York (Serif)"
        case .georgia: return "Georgia (Serif)"
        case .menlo: return "Menlo (Monospace)"
        }
    }
}

/// Theme options for the RSVP reader.
enum ReaderTheme: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
}

/// Constants for App Group settings shared between the app and extension.
enum SettingsKeys {
    /// App Group identifier — must match the entitlements file.
    static let appGroupID = "group.com.speedreader.shared"

    static let wpm = "sr_wpm"
    static let font = "sr_font"
    static let theme = "sr_theme"
    static let fontSize = "sr_fontSize"
    static let punctuationPause = "sr_punctuationPause"

    /// Default values — typed enum cases prevent drift from raw values.
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
    static let fontSizeMin = 24
    static let fontSizeMax = 96

    /// Font size range for sliders
    static let fontSizeRange = Double(fontSizeMin)...Double(fontSizeMax)

    /// Clamp an integer to a range.
    static func clamp(_ value: Int, min: Int, max: Int) -> Int {
        Swift.max(min, Swift.min(max, value))
    }

    /// Saves settings to the given UserDefaults store with type checking and clamping.
    /// Returns the number of fields that matched expected types.
    @discardableResult
    static func saveSettings(_ settings: [String: Any], to defaults: UserDefaults) -> Int {
        var savedCount = 0

        if let wpm = settings["wpm"] as? Int {
            defaults.set(clamp(wpm, min: wpmMin, max: wpmMax), forKey: SettingsKeys.wpm)
            savedCount += 1
        }
        if let font = settings["font"] as? String,
           ReaderFont(rawValue: font) != nil {
            defaults.set(font, forKey: SettingsKeys.font)
            savedCount += 1
        }
        if let theme = settings["theme"] as? String,
           ReaderTheme(rawValue: theme) != nil {
            defaults.set(theme, forKey: SettingsKeys.theme)
            savedCount += 1
        }
        if let fontSize = settings["fontSize"] as? Int {
            defaults.set(clamp(fontSize, min: fontSizeMin, max: fontSizeMax), forKey: SettingsKeys.fontSize)
            savedCount += 1
        }
        if let punctuationPause = settings["punctuationPause"] as? Bool {
            defaults.set(punctuationPause, forKey: SettingsKeys.punctuationPause)
            savedCount += 1
        }

        if savedCount == 0 && !settings.isEmpty {
            os_log(
                .error,
                "[SpeedReader] saveSettings: 0/%d keys matched types",
                settings.count
            )
        }

        return savedCount
    }
}
