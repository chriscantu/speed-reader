@testable import SpeedReader
import XCTest

final class SettingsTests: XCTestCase {
    /// Ephemeral UserDefaults per test — avoids App Group dependency and test pollution.
    private func makeSettings() -> ReaderSettings {
        // swiftlint:disable:next force_unwrapping
        let ephemeral = UserDefaults(suiteName: "test.\(UUID().uuidString)")!
        return ReaderSettings(defaults: ephemeral)
    }

    func testDefaultWPM() {
        let settings = makeSettings()
        XCTAssertEqual(settings.wpm, 250)
    }

    func testWPMClampedToMinimum() {
        let settings = makeSettings()
        settings.wpm = 50
        XCTAssertEqual(settings.wpm, 100)
    }

    func testWPMClampedToMaximum() {
        let settings = makeSettings()
        settings.wpm = 800
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
        settings.fontSize = 10
        XCTAssertEqual(settings.fontSize, 28)
    }

    func testFontSizeClampedToMaximum() {
        let settings = makeSettings()
        settings.fontSize = 100
        XCTAssertEqual(settings.fontSize, 64)
    }
}
