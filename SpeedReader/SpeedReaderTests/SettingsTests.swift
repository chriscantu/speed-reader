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
