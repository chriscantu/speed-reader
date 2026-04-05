import Foundation
import os.log
import SwiftUI

/// Observable settings model backed by App Group UserDefaults.
@Observable
final class ReaderSettings {
    private let defaults: UserDefaults

    /// True when App Group UserDefaults is available; false means settings won't sync with the extension.
    private(set) var appGroupAvailable: Bool = false

    var wpm: Int = SettingsKeys.Defaults.wpm
    var font: ReaderFont = SettingsKeys.Defaults.font
    var theme: ReaderTheme = SettingsKeys.Defaults.theme
    var fontSize: Int = SettingsKeys.Defaults.fontSize
    var punctuationPause: Bool = SettingsKeys.Defaults.punctuationPause
    var alignment: ReaderAlignment = SettingsKeys.Defaults.alignment

    init(defaults: UserDefaults? = nil) {
        let store: UserDefaults
        if let injected = defaults {
            store = injected
            appGroupAvailable = true  // Injected defaults are assumed valid (tests, etc.)
        } else if let groupDefaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
            store = groupDefaults
            appGroupAvailable = true
        } else {
            os_log(
                .error,
                "[SpeedReader] App Group '%{public}@' not configured — settings will not sync with extension",
                SettingsKeys.appGroupID
            )
            store = .standard
            appGroupAvailable = false
        }

        self.defaults = store
        loadFromDefaults(store)
    }

    /// Sets WPM, clamped to valid range, and persists to UserDefaults.
    func setWpm(_ value: Int) {
        wpm = SettingsKeys.clamp(value, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax)
        defaults.set(wpm, forKey: SettingsKeys.wpm)
    }

    /// Sets font size, clamped to valid range, and persists to UserDefaults.
    func setFontSize(_ value: Int) {
        fontSize = SettingsKeys.clamp(
            value, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax
        )
        defaults.set(fontSize, forKey: SettingsKeys.fontSize)
    }

    /// Sets font and persists to UserDefaults.
    func setFont(_ value: ReaderFont) {
        font = value
        defaults.set(font.rawValue, forKey: SettingsKeys.font)
    }

    /// Sets theme and persists to UserDefaults.
    func setTheme(_ value: ReaderTheme) {
        theme = value
        defaults.set(theme.rawValue, forKey: SettingsKeys.theme)
    }

    /// Sets punctuation pause and persists to UserDefaults.
    func setPunctuationPause(_ value: Bool) {
        punctuationPause = value
        defaults.set(punctuationPause, forKey: SettingsKeys.punctuationPause)
    }

    /// Sets alignment and persists to UserDefaults.
    func setAlignment(_ value: ReaderAlignment) {
        alignment = value
        defaults.set(alignment.rawValue, forKey: SettingsKeys.alignment)
    }

    private func loadFromDefaults(_ store: UserDefaults) {
        let loadedWpm = store.object(forKey: SettingsKeys.wpm) as? Int
            ?? SettingsKeys.Defaults.wpm
        wpm = SettingsKeys.clamp(loadedWpm, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax)

        let fontRaw = store.string(forKey: SettingsKeys.font)
            ?? SettingsKeys.Defaults.font.rawValue
        font = ReaderFont(rawValue: fontRaw) ?? SettingsKeys.Defaults.font

        let themeRaw = store.string(forKey: SettingsKeys.theme)
            ?? SettingsKeys.Defaults.theme.rawValue
        theme = ReaderTheme(rawValue: themeRaw) ?? SettingsKeys.Defaults.theme

        let loadedFontSize = store.object(forKey: SettingsKeys.fontSize) as? Int
            ?? SettingsKeys.Defaults.fontSize
        fontSize = SettingsKeys.clamp(
            loadedFontSize, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax
        )

        punctuationPause = store.object(forKey: SettingsKeys.punctuationPause) as? Bool
            ?? SettingsKeys.Defaults.punctuationPause

        let alignmentRaw = store.string(forKey: SettingsKeys.alignment)
            ?? SettingsKeys.Defaults.alignment.rawValue
        alignment = ReaderAlignment(rawValue: alignmentRaw) ?? SettingsKeys.Defaults.alignment
    }
}
