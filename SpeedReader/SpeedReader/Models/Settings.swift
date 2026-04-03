import Foundation
import os.log
import SwiftUI

/// Observable settings model backed by App Group UserDefaults.
@Observable
final class ReaderSettings {
    private let defaults: UserDefaults

    // @Observable macro synthesizes _propertyName backing stores, so we use
    // @ObservationIgnored stored properties + computed properties to avoid
    // collision and prevent didSet infinite recursion.
    @ObservationIgnored private var storedWpm: Int = SettingsKeys.Defaults.wpm
    @ObservationIgnored private var storedFont: ReaderFont = SettingsKeys.Defaults.font
    @ObservationIgnored private var storedTheme: ReaderTheme = SettingsKeys.Defaults.theme
    @ObservationIgnored private var storedFontSize: Int = SettingsKeys.Defaults.fontSize
    @ObservationIgnored private var storedPunctuationPause: Bool = SettingsKeys.Defaults.punctuationPause

    var wpm: Int {
        get {
            access(keyPath: \.wpm)
            return storedWpm
        }
        set {
            withMutation(keyPath: \.wpm) {
                storedWpm = SettingsKeys.clamp(newValue, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax)
                defaults.set(storedWpm, forKey: SettingsKeys.wpm)
            }
        }
    }

    var font: ReaderFont {
        get {
            access(keyPath: \.font)
            return storedFont
        }
        set {
            withMutation(keyPath: \.font) {
                storedFont = newValue
                defaults.set(storedFont.rawValue, forKey: SettingsKeys.font)
            }
        }
    }

    var theme: ReaderTheme {
        get {
            access(keyPath: \.theme)
            return storedTheme
        }
        set {
            withMutation(keyPath: \.theme) {
                storedTheme = newValue
                defaults.set(storedTheme.rawValue, forKey: SettingsKeys.theme)
            }
        }
    }

    var fontSize: Int {
        get {
            access(keyPath: \.fontSize)
            return storedFontSize
        }
        set {
            withMutation(keyPath: \.fontSize) {
                storedFontSize = SettingsKeys.clamp(
                    newValue, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax
                )
                defaults.set(storedFontSize, forKey: SettingsKeys.fontSize)
            }
        }
    }

    var punctuationPause: Bool {
        get {
            access(keyPath: \.punctuationPause)
            return storedPunctuationPause
        }
        set {
            withMutation(keyPath: \.punctuationPause) {
                storedPunctuationPause = newValue
                defaults.set(storedPunctuationPause, forKey: SettingsKeys.punctuationPause)
            }
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
        storedWpm = SettingsKeys.clamp(loadedWpm, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax)

        let fontRaw = store.string(forKey: SettingsKeys.font)
            ?? SettingsKeys.Defaults.font.rawValue
        storedFont = ReaderFont(rawValue: fontRaw) ?? SettingsKeys.Defaults.font

        let themeRaw = store.string(forKey: SettingsKeys.theme)
            ?? SettingsKeys.Defaults.theme.rawValue
        storedTheme = ReaderTheme(rawValue: themeRaw) ?? SettingsKeys.Defaults.theme

        let loadedFontSize = store.object(forKey: SettingsKeys.fontSize) as? Int
            ?? SettingsKeys.Defaults.fontSize
        storedFontSize = SettingsKeys.clamp(
            loadedFontSize, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax
        )

        storedPunctuationPause = store.object(forKey: SettingsKeys.punctuationPause) as? Bool
            ?? SettingsKeys.Defaults.punctuationPause
    }
}
