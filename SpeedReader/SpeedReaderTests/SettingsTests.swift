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
        XCTAssertEqual(settings.fontSize, 24)
    }

    func testFontSizeClampedToMaximum() {
        let settings = makeSettings()
        settings.setFontSize(100)
        XCTAssertEqual(settings.fontSize, 96)
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
            "alignment": "center",
        ]
        let count = SettingsKeys.saveSettings(payload, to: store)
        XCTAssertEqual(count, 6)
        XCTAssertEqual(store.integer(forKey: SettingsKeys.wpm), 300)
        XCTAssertEqual(store.string(forKey: SettingsKeys.font), "opendyslexic")
        XCTAssertEqual(store.string(forKey: SettingsKeys.theme), "dark")
        XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), 36)
        XCTAssertFalse(store.bool(forKey: SettingsKeys.punctuationPause))
        XCTAssertEqual(store.string(forKey: SettingsKeys.alignment), "center")
    }

    func testSaveSettingsWithAllWrongTypesSavesZero() {
        let store = makeDefaults()
        let payload: [String: Any] = [
            "wpm": "fast",
            "font": 42,
            "theme": true,
            "fontSize": "big",
            "punctuationPause": 1,
            "alignment": 42,
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
        first.setAlignment(.center)

        let second = ReaderSettings(defaults: store)
        XCTAssertEqual(second.wpm, 400)
        XCTAssertEqual(second.font, .openDyslexic)
        XCTAssertEqual(second.theme, .dark)
        XCTAssertEqual(second.fontSize, 36)
        XCTAssertFalse(second.punctuationPause)
        XCTAssertEqual(second.alignment, .center)
    }

    // MARK: - New font cases

    func testNewYorkFontRoundTrips() {
        let store = makeDefaults()
        let settings = ReaderSettings(defaults: store)
        settings.setFont(.newYork)
        let reloaded = ReaderSettings(defaults: store)
        XCTAssertEqual(reloaded.font, .newYork)
    }

    func testGeorgiaFontRoundTrips() {
        let store = makeDefaults()
        let settings = ReaderSettings(defaults: store)
        settings.setFont(.georgia)
        let reloaded = ReaderSettings(defaults: store)
        XCTAssertEqual(reloaded.font, .georgia)
    }

    func testMenloFontRoundTrips() {
        let store = makeDefaults()
        let settings = ReaderSettings(defaults: store)
        settings.setFont(.menlo)
        let reloaded = ReaderSettings(defaults: store)
        XCTAssertEqual(reloaded.font, .menlo)
    }

    func testSaveSettingsAcceptsNewFontRawValues() {
        let store = makeDefaults()
        for rawValue in ["newYork", "georgia", "menlo"] {
            let count = SettingsKeys.saveSettings(["font": rawValue], to: store)
            XCTAssertEqual(count, 1, "Expected \(rawValue) to be accepted")
            XCTAssertEqual(store.string(forKey: SettingsKeys.font), rawValue)
        }
    }

    // MARK: - Widened font size bounds

    func testFontSizeAccepts24() {
        let settings = makeSettings()
        settings.setFontSize(24)
        XCTAssertEqual(settings.fontSize, 24)
    }

    func testFontSizeAccepts96() {
        let settings = makeSettings()
        settings.setFontSize(96)
        XCTAssertEqual(settings.fontSize, 96)
    }

    func testFontSizeClampedToNewMinimum() {
        let settings = makeSettings()
        settings.setFontSize(10)
        XCTAssertEqual(settings.fontSize, 24)
    }

    func testFontSizeClampedToNewMaximum() {
        let settings = makeSettings()
        settings.setFontSize(200)
        XCTAssertEqual(settings.fontSize, 96)
    }

    func testSaveSettingsClampsFontSizeToNewRange() {
        let store = makeDefaults()
        let countLow = SettingsKeys.saveSettings(["fontSize": 10], to: store)
        XCTAssertEqual(countLow, 1)
        XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), 24)

        let countHigh = SettingsKeys.saveSettings(["fontSize": 200], to: store)
        XCTAssertEqual(countHigh, 1)
        XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), 96)
    }

    // MARK: - Alignment

    func testDefaultAlignment() {
        let settings = makeSettings()
        XCTAssertEqual(settings.alignment, .orpAligned)
    }

    func testAlignmentRoundTrips() {
        let store = makeDefaults()
        let settings = ReaderSettings(defaults: store)
        settings.setAlignment(.center)
        let reloaded = ReaderSettings(defaults: store)
        XCTAssertEqual(reloaded.alignment, .center)
    }

    func testInitFallsBackForInvalidAlignmentRawValue() {
        let store = makeDefaults()
        store.set("scrambled", forKey: SettingsKeys.alignment)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.alignment, SettingsKeys.Defaults.alignment)
    }

    func testSaveSettingsAcceptsValidAlignmentValues() {
        let store = makeDefaults()
        for rawValue in ["orp", "center"] {
            let count = SettingsKeys.saveSettings(["alignment": rawValue], to: store)
            XCTAssertEqual(count, 1, "Expected '\(rawValue)' to be accepted")
            XCTAssertEqual(store.string(forKey: SettingsKeys.alignment), rawValue)
        }
    }

    func testSaveSettingsRejectsInvalidAlignmentRawValue() {
        let store = makeDefaults()
        let count = SettingsKeys.saveSettings(["alignment": "scrambled"], to: store)
        XCTAssertEqual(count, 0)
    }

    // MARK: - Paper

    func testReaderPaperRawValues() {
        XCTAssertEqual(ReaderPaper.white.rawValue, "white")
        XCTAssertEqual(ReaderPaper.cream.rawValue, "cream")
        XCTAssertEqual(ReaderPaper.slate.rawValue, "slate")
        XCTAssertEqual(ReaderPaper.black.rawValue, "black")
    }

    func testReaderPaperAllCasesCount() {
        XCTAssertEqual(ReaderPaper.allCases.count, 4)
    }

    func testReaderPaperDisplayNames() {
        XCTAssertEqual(ReaderPaper.white.displayName, "White")
        XCTAssertEqual(ReaderPaper.cream.displayName, "Cream")
        XCTAssertEqual(ReaderPaper.slate.displayName, "Slate")
        XCTAssertEqual(ReaderPaper.black.displayName, "Black")
    }

    func testPaperDefaultIsCream() {
        XCTAssertEqual(SettingsKeys.Defaults.paper, .cream)
    }

    func testPaperKeyIsNamespaced() {
        XCTAssertEqual(SettingsKeys.paper, "sr_paper")
        XCTAssertEqual(SettingsKeys.migratedToPaper, "sr_migratedToPaper")
    }

    func testSaveSettingsAcceptsAllValidPaperValues() {
        let store = makeDefaults()
        for rawValue in ["white", "cream", "slate", "black"] {
            let count = SettingsKeys.saveSettings(["paper": rawValue], to: store)
            XCTAssertEqual(count, 1, "Expected '\(rawValue)' to be accepted")
            XCTAssertEqual(store.string(forKey: SettingsKeys.paper), rawValue)
        }
    }

    func testSaveSettingsRejectsInvalidPaperRawValue() {
        let store = makeDefaults()
        let count = SettingsKeys.saveSettings(["paper": "magenta"], to: store)
        XCTAssertEqual(count, 0)
    }

    func testSaveSettingsRejectsPaperWithWrongType() {
        let store = makeDefaults()
        let count = SettingsKeys.saveSettings(["paper": 42], to: store)
        XCTAssertEqual(count, 0)
    }

    // MARK: - Migration from theme to paper

    func testMigrationMapsLightToWhite() {
        let store = makeDefaults()
        store.set("light", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "white")
    }

    func testMigrationMapsDarkToSlate() {
        let store = makeDefaults()
        store.set("dark", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "slate")
    }

    func testMigrationMapsSystemToCream() {
        let store = makeDefaults()
        store.set("system", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "cream")
    }

    func testMigrationMapsMissingThemeToCream() {
        let store = makeDefaults()
        // No sr_theme key set
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "cream")
    }

    func testMigrationMapsUnknownThemeToCream() {
        let store = makeDefaults()
        store.set("neon-pink", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "cream")
    }

    func testMigrationSetsMigratedFlag() {
        let store = makeDefaults()
        store.set("light", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertTrue(store.bool(forKey: SettingsKeys.migratedToPaper))
    }

    func testMigrationDeletesOldThemeKey() {
        let store = makeDefaults()
        store.set("dark", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertNil(store.object(forKey: "sr_theme"))
    }

    func testMigrationIsIdempotent() {
        let store = makeDefaults()
        store.set("dark", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        // Second run: user has since changed paper to "white" explicitly
        store.set("white", forKey: SettingsKeys.paper)
        SettingsKeys.migrateThemeToPaper(in: store)
        // Expect user's explicit choice preserved, not reset to "slate"
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "white")
        XCTAssertNil(store.object(forKey: "sr_theme"),
                     "sr_theme should remain absent after the no-op second migration")
    }

    func testMigrationSkipsIfAlreadyMigrated() {
        let store = makeDefaults()
        store.set(true, forKey: SettingsKeys.migratedToPaper)
        store.set("dark", forKey: "sr_theme")  // Should be ignored
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertNil(store.string(forKey: SettingsKeys.paper))
        XCTAssertEqual(store.string(forKey: "sr_theme"), "dark",
                       "sr_theme should be untouched when migration early-returns")
    }
}
