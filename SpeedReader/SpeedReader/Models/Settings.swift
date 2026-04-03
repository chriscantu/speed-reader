import Foundation
import SwiftUI
import os.log

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
            wpm = SettingsKeys.clamp(wpm, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax)
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
            fontSize = SettingsKeys.clamp(fontSize, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax)
            defaults.set(fontSize, forKey: SettingsKeys.fontSize)
        }
    }

    var punctuationPause: Bool {
        didSet { defaults.set(punctuationPause, forKey: SettingsKeys.punctuationPause) }
    }

    init(defaults: UserDefaults? = nil) {
        let store: UserDefaults
        if let injected = defaults {
            store = injected
        } else if let groupDefaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
            store = groupDefaults
        } else {
            os_log(.error, "[SpeedReader] App Group '%{public}@' not configured — settings will not sync with extension",
                   SettingsKeys.appGroupID)
            store = .standard
        }

        self.defaults = store

        // Clamp values loaded from UserDefaults — didSet does NOT fire during init
        let loadedWpm = store.object(forKey: SettingsKeys.wpm) as? Int
            ?? SettingsKeys.Defaults.wpm
        self.wpm = SettingsKeys.clamp(loadedWpm, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax)

        let fontRaw = store.string(forKey: SettingsKeys.font)
            ?? SettingsKeys.Defaults.font.rawValue
        self.font = ReaderFont(rawValue: fontRaw) ?? SettingsKeys.Defaults.font

        let themeRaw = store.string(forKey: SettingsKeys.theme)
            ?? SettingsKeys.Defaults.theme.rawValue
        self.theme = ReaderTheme(rawValue: themeRaw) ?? SettingsKeys.Defaults.theme

        let loadedFontSize = store.object(forKey: SettingsKeys.fontSize) as? Int
            ?? SettingsKeys.Defaults.fontSize
        self.fontSize = SettingsKeys.clamp(loadedFontSize, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax)

        self.punctuationPause = store.object(forKey: SettingsKeys.punctuationPause) as? Bool
            ?? SettingsKeys.Defaults.punctuationPause
    }
}
