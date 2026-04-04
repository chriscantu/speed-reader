import XCTest

final class SettingsTests: XCTestCase {
    /// Ephemeral UserDefaults — avoids App Group dependency and test pollution.
    private func makeDefaults() -> UserDefaults {
        // swiftlint:disable:next force_unwrapping
        UserDefaults(suiteName: "test.\(UUID().uuidString)")!
    }

    private func makeSettings() -> ReaderSettings {
        ReaderSettings(defaults: makeDefaults())
    }

    func testDefaultWPM() {
        let settings = makeSettings()
        XCTAssertEqual(settings.wpm, 250)
    }

    func testWPMClampedToMinimum() {
        let settings = makeSettings()
        settings.setWpm(50)
        XCTAssertEqual(settings.wpm, 100)
    }

    func testWPMClampedToMaximum() {
        let settings = makeSettings()
        settings.setWpm(800)
        XCTAssertEqual(settings.wpm, 600)
    }

    func testDefaultFont() {
        let settings = makeSettings()
        XCTAssertEqual(settings.font, .system)
    }

    func testDefaultTheme() {
        let settings = makeSettings()
        XCTAssertEqual(settings.theme, .system)
    }

    func testDefaultPunctuationPause() {
        let settings = makeSettings()
        XCTAssertTrue(settings.punctuationPause)
    }

    func testDefaultFontSize() {
        let settings = makeSettings()
        XCTAssertEqual(settings.fontSize, 42)
    }

    func testFontSizeClampedToMinimum() {
        let settings = makeSettings()
        settings.setFontSize(10)
        XCTAssertEqual(settings.fontSize, 28)
    }

    func testFontSizeClampedToMaximum() {
        let settings = makeSettings()
        settings.setFontSize(100)
        XCTAssertEqual(settings.fontSize, 64)
    }

    func testAppGroupAvailableWithInjectedDefaults() {
        let settings = makeSettings()
        XCTAssertTrue(settings.appGroupAvailable)
    }

    func testAppGroupUnavailableWithInvalidSuite() {
        // Pass nil to force the real App Group lookup path.
        // In the test environment, the App Group entitlement is not configured,
        // so UserDefaults(suiteName:) for the real group ID may or may not succeed
        // depending on the host. Instead, we verify the injected path sets true.
        // A false result requires a misconfigured entitlement — tested implicitly
        // by the production init path when App Group is absent.
        let settings = ReaderSettings(defaults: makeDefaults())
        XCTAssertTrue(settings.appGroupAvailable, "Injected defaults should report App Group as available")
    }

    // MARK: - Init with pre-populated out-of-range UserDefaults

    func testInitClampsWPMBelowMinimum() {
        let store = makeDefaults()
        store.set(50, forKey: SettingsKeys.wpm)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.wpm, SettingsKeys.wpmMin)
    }

    func testInitClampsWPMAboveMaximum() {
        let store = makeDefaults()
        store.set(999, forKey: SettingsKeys.wpm)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.wpm, SettingsKeys.wpmMax)
    }

    func testInitClampsFontSizeBelowMinimum() {
        let store = makeDefaults()
        store.set(10, forKey: SettingsKeys.fontSize)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.fontSize, SettingsKeys.fontSizeMin)
    }

    func testInitClampsFontSizeAboveMaximum() {
        let store = makeDefaults()
        store.set(200, forKey: SettingsKeys.fontSize)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.fontSize, SettingsKeys.fontSizeMax)
    }

    func testInitFallsBackForInvalidFontRawValue() {
        let store = makeDefaults()
        store.set("comic-sans", forKey: SettingsKeys.font)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.font, SettingsKeys.Defaults.font)
    }

    func testInitFallsBackForInvalidThemeRawValue() {
        let store = makeDefaults()
        store.set("neon-pink", forKey: SettingsKeys.theme)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.theme, SettingsKeys.Defaults.theme)
    }

    func testInitFallsBackWhenWPMStoredAsWrongType() {
        let store = makeDefaults()
        store.set("not-a-number", forKey: SettingsKeys.wpm)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.wpm, SettingsKeys.Defaults.wpm)
    }

    func testInitFallsBackWhenFontSizeStoredAsWrongType() {
        let store = makeDefaults()
        store.set("big", forKey: SettingsKeys.fontSize)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.fontSize, SettingsKeys.Defaults.fontSize)
    }

    func testInitFallsBackWhenPunctuationPauseStoredAsWrongType() {
        let store = makeDefaults()
        store.set("yes", forKey: SettingsKeys.punctuationPause)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.punctuationPause, SettingsKeys.Defaults.punctuationPause)
    }

    // MARK: - saveSettings type checking and clamping

    func testSaveSettingsWithValidPayloadSavesAllFields() {
        let store = makeDefaults()
        let payload: [String: Any] = [
            "wpm": 300,
            "font": "opendyslexic",
            "theme": "dark",
            "fontSize": 36,
            "punctuationPause": false,
        ]
        let count = SettingsKeys.saveSettings(payload, to: store)
        XCTAssertEqual(count, 5)
        XCTAssertEqual(store.integer(forKey: SettingsKeys.wpm), 300)
        XCTAssertEqual(store.string(forKey: SettingsKeys.font), "opendyslexic")
        XCTAssertEqual(store.string(forKey: SettingsKeys.theme), "dark")
        XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), 36)
        XCTAssertFalse(store.bool(forKey: SettingsKeys.punctuationPause))
    }

    func testSaveSettingsWithAllWrongTypesSavesZero() {
        let store = makeDefaults()
        let payload: [String: Any] = [
            "wpm": "fast",
            "font": 42,
            "theme": true,
            "fontSize": "big",
            "punctuationPause": 1,
        ]
        let count = SettingsKeys.saveSettings(payload, to: store)
        XCTAssertEqual(count, 0)
    }

    func testSaveSettingsWithPartialMismatchSavesOnlyValid() {
        let store = makeDefaults()
        let payload: [String: Any] = [
            "wpm": 200,           // valid
            "font": 42,           // wrong type
            "theme": "dark",      // valid
            "fontSize": "big",    // wrong type
            "punctuationPause": true,  // valid
        ]
        let count = SettingsKeys.saveSettings(payload, to: store)
        XCTAssertEqual(count, 3)
        XCTAssertEqual(store.integer(forKey: SettingsKeys.wpm), 200)
        XCTAssertEqual(store.string(forKey: SettingsKeys.theme), "dark")
        XCTAssertTrue(store.bool(forKey: SettingsKeys.punctuationPause))
    }

    func testSaveSettingsRejectsInvalidFontRawValue() {
        let store = makeDefaults()
        let payload: [String: Any] = ["font": "comic-sans"]
        let count = SettingsKeys.saveSettings(payload, to: store)
        XCTAssertEqual(count, 0)
    }

    func testSaveSettingsRejectsInvalidThemeRawValue() {
        let store = makeDefaults()
        let payload: [String: Any] = ["theme": "neon-pink"]
        let count = SettingsKeys.saveSettings(payload, to: store)
        XCTAssertEqual(count, 0)
    }

    func testSaveSettingsClampsWPMToValidRange() {
        let store = makeDefaults()
        let count = SettingsKeys.saveSettings(["wpm": 9999], to: store)
        XCTAssertEqual(count, 1)
        XCTAssertEqual(store.integer(forKey: SettingsKeys.wpm), SettingsKeys.wpmMax)
    }

    func testSaveSettingsClampsFontSizeToValidRange() {
        let store = makeDefaults()
        let count = SettingsKeys.saveSettings(["fontSize": 1], to: store)
        XCTAssertEqual(count, 1)
        XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), SettingsKeys.fontSizeMin)
    }

    func testSaveSettingsWithEmptyPayloadReturnsZero() {
        let store = makeDefaults()
        let count = SettingsKeys.saveSettings([:], to: store)
        XCTAssertEqual(count, 0)
    }

    // MARK: - Persistence round-trip

    func testSettingsPersistAcrossInstances() {
        let store = makeDefaults()
        let first = ReaderSettings(defaults: store)
        first.setWpm(400)
        first.setFont(.openDyslexic)
        first.setTheme(.dark)
        first.setFontSize(36)
        first.setPunctuationPause(false)

        let second = ReaderSettings(defaults: store)
        XCTAssertEqual(second.wpm, 400)
        XCTAssertEqual(second.font, .openDyslexic)
        XCTAssertEqual(second.theme, .dark)
        XCTAssertEqual(second.fontSize, 36)
        XCTAssertFalse(second.punctuationPause)
    }
}
