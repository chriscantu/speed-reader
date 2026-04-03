import Foundation
import os.log
import SwiftUI

/// Observable settings model backed by App Group UserDefaults.
@Observable
final class ReaderSettings {
    private let defaults: UserDefaults

    // Backing stores — @Observable rewrites properties, making didSet self-assignment
    // cause infinite recursion. Use private backing + computed properties instead.
    private var _wpm: Int
    private var _font: ReaderFont
    private var _theme: ReaderTheme
    private var _fontSize: Int
    private var _punctuationPause: Bool

    var wpm: Int {
        get { _wpm }
        set {
            _wpm = SettingsKeys.clamp(newValue, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax)
            defaults.set(_wpm, forKey: SettingsKeys.wpm)
        }
    }

    var font: ReaderFont {
        get { _font }
        set {
            _font = newValue
            defaults.set(_font.rawValue, forKey: SettingsKeys.font)
        }
    }

    var theme: ReaderTheme {
        get { _theme }
        set {
            _theme = newValue
            defaults.set(_theme.rawValue, forKey: SettingsKeys.theme)
        }
    }

    var fontSize: Int {
        get { _fontSize }
        set {
            _fontSize = SettingsKeys.clamp(newValue, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax)
            defaults.set(_fontSize, forKey: SettingsKeys.fontSize)
        }
    }

    var punctuationPause: Bool {
        get { _punctuationPause }
        set {
            _punctuationPause = newValue
            defaults.set(_punctuationPause, forKey: SettingsKeys.punctuationPause)
        }
    }

    init(defaults: UserDefaults? = nil) {
        let store: UserDefaults
        if let injected = defaults {
            store = injected
        } else if let groupDefaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
            store = groupDefaults
        } else {
            os_log(
                .error,
                "[SpeedReader] App Group '%{public}@' not configured — settings will not sync with extension",
                SettingsKeys.appGroupID
            )
            store = .standard
        }

        self.defaults = store

        let loadedWpm = store.object(forKey: SettingsKeys.wpm) as? Int
            ?? SettingsKeys.Defaults.wpm
        self._wpm = SettingsKeys.clamp(loadedWpm, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax)

        let fontRaw = store.string(forKey: SettingsKeys.font)
            ?? SettingsKeys.Defaults.font.rawValue
        self._font = ReaderFont(rawValue: fontRaw) ?? SettingsKeys.Defaults.font

        let themeRaw = store.string(forKey: SettingsKeys.theme)
            ?? SettingsKeys.Defaults.theme.rawValue
        self._theme = ReaderTheme(rawValue: themeRaw) ?? SettingsKeys.Defaults.theme

        let loadedFontSize = store.object(forKey: SettingsKeys.fontSize) as? Int
            ?? SettingsKeys.Defaults.fontSize
        self._fontSize = SettingsKeys.clamp(
            loadedFontSize, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax
        )

        self._punctuationPause = store.object(forKey: SettingsKeys.punctuationPause) as? Bool
            ?? SettingsKeys.Defaults.punctuationPause
    }
}
