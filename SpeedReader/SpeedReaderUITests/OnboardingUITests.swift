import XCTest

final class OnboardingUITests: XCTestCase {
    private var app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
        // Reset onboarding state so the sheet appears
        app.launchArguments += ["-hasCompletedOnboarding", "NO"]
        app.launch()
    }

    // MARK: - Onboarding content

    func testOnboardingSheetAppears() {
        // The sheet should show "SpeedReader" title
        let title = app.staticTexts["SpeedReader"]
        XCTAssertTrue(title.waitForExistence(timeout: 5), "Onboarding sheet should appear")
    }

    #if os(macOS)

    func testMacOSShowsOpenSafariSettingsButton() {
        let button = app.buttons["Open Safari Settings"]
        XCTAssertTrue(button.waitForExistence(timeout: 5))
    }

    func testMacOSInstructionsMentionSafari() {
        XCTAssertTrue(app.staticTexts["Open Safari Settings"].exists)
    }

    func testMacOSInstructionsMentionExtensions() {
        XCTAssertTrue(app.staticTexts["Tap Extensions"].exists)
    }

    #else

    func testIOSShowsOpenSettingsAppButton() {
        let button = app.buttons["Open Settings App"]
        XCTAssertTrue(button.waitForExistence(timeout: 5))
    }

    func testIOSInstructionsMentionBackNavigation() {
        let backText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Back'"))
        XCTAssertGreaterThan(backText.count, 0, "Should mention navigating Back")
    }

    func testIOSInstructionsGuideThroughSafariExtensions() {
        let safariPath = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Safari'"))
        XCTAssertGreaterThan(safariPath.count, 0, "Should mention Safari in instructions")
    }

    func testIOSShowsHelperText() {
        let helperText = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS 'This opens SpeedReader settings'")
        )
        XCTAssertGreaterThan(helperText.count, 0, "Helper text should be visible below button")
    }

    func testIOSTapOpenSettingsOpensSettingsApp() throws {
        let button = app.buttons["Open Settings App"]
        XCTAssertTrue(button.waitForExistence(timeout: 5))
        button.tap()

        // After tapping, the Settings app should launch (SpeedReader goes to background).
        // We can verify by checking that a Settings app element appears.
        let settingsApp = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
        let settingsNavBar = settingsApp.navigationBars.firstMatch
        XCTAssertTrue(
            settingsNavBar.waitForExistence(timeout: 5),
            "Settings app should open after tapping 'Open Settings App'"
        )
    }

    #endif

    func testIveEnabledItButtonExists() {
        let button = app.buttons["I've enabled it"]
        XCTAssertTrue(button.waitForExistence(timeout: 5))
    }
}
