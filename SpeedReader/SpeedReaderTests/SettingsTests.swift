import XCTest
@testable import SpeedReader

final class SettingsTests: XCTestCase {
    func testDefaultWPM() {
        let settings = ReaderSettings()
        XCTAssertEqual(settings.wpm, 250)
    }

    func testWPMClampedToMinimum() {
        let settings = ReaderSettings()
        settings.wpm = 50
        XCTAssertEqual(settings.wpm, 100)
    }

    func testWPMClampedToMaximum() {
        let settings = ReaderSettings()
        settings.wpm = 800
        XCTAssertEqual(settings.wpm, 600)
    }

    func testDefaultFont() {
        let settings = ReaderSettings()
        XCTAssertEqual(settings.font, .system)
    }

    func testDefaultTheme() {
        let settings = ReaderSettings()
        XCTAssertEqual(settings.theme, .system)
    }

    func testDefaultPunctuationPause() {
        let settings = ReaderSettings()
        XCTAssertTrue(settings.punctuationPause)
    }

    func testDefaultFontSize() {
        let settings = ReaderSettings()
        XCTAssertEqual(settings.fontSize, 42)
    }
}
