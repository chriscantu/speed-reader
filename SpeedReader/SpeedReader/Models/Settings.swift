import Foundation
import SwiftUI

/// Font options for the RSVP reader.
enum ReaderFont: String, CaseIterable, Identifiable {
    case system = "system"
    case openDyslexic = "opendyslexic"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System (San Francisco)"
        case .openDyslexic: return "OpenDyslexic"
        }
    }
}

/// Theme options for the RSVP reader.
enum ReaderTheme: String, CaseIterable, Identifiable {
    case system = "system"
    case light = "light"
    case dark = "dark"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
}

/// Observable settings model backed by App Group UserDefaults.
@Observable
final class ReaderSettings {
    private let defaults: UserDefaults

    var wpm: Int {
        didSet {
            wpm = max(SettingsKeys.wpmMin, min(SettingsKeys.wpmMax, wpm))
            defaults.set(wpm, forKey: SettingsKeys.wpm)
        }
    }

    var font: ReaderFont {
        didSet { defaults.set(font.rawValue, forKey: SettingsKeys.font) }
    }

    var theme: ReaderTheme {
        didSet { defaults.set(theme.rawValue, forKey: SettingsKeys.theme) }
    }

    var fontSize: Int {
        didSet {
            fontSize = max(SettingsKeys.fontSizeMin, min(SettingsKeys.fontSizeMax, fontSize))
            defaults.set(fontSize, forKey: SettingsKeys.fontSize)
        }
    }

    var punctuationPause: Bool {
        didSet { defaults.set(punctuationPause, forKey: SettingsKeys.punctuationPause) }
    }

    init(defaults: UserDefaults? = nil) {
        let store = defaults
            ?? UserDefaults(suiteName: SettingsKeys.appGroupID)
            ?? .standard

        self.defaults = store

        self.wpm = store.object(forKey: SettingsKeys.wpm) as? Int
            ?? SettingsKeys.Defaults.wpm

        let fontRaw = store.string(forKey: SettingsKeys.font)
            ?? SettingsKeys.Defaults.font
        self.font = ReaderFont(rawValue: fontRaw) ?? .system

        let themeRaw = store.string(forKey: SettingsKeys.theme)
            ?? SettingsKeys.Defaults.theme
        self.theme = ReaderTheme(rawValue: themeRaw) ?? .system

        self.fontSize = store.object(forKey: SettingsKeys.fontSize) as? Int
            ?? SettingsKeys.Defaults.fontSize

        self.punctuationPause = store.object(forKey: SettingsKeys.punctuationPause) as? Bool
            ?? SettingsKeys.Defaults.punctuationPause
    }
}
