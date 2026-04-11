import XCTest

final class OnboardingUITests: XCTestCase {
    private var app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
        // Override the onboarding phase so tests start in Phase 1
        app.launchArguments += ["-sr_onboardingPhase", "enableExtension"]
        app.launch()
    }

    // MARK: - Onboarding content

    func testOnboardingSheetAppears() {
        let title = app.staticTexts["SpeedReader"]
        XCTAssertTrue(title.waitForExistence(timeout: 5), "Onboarding sheet should appear")
    }

    #if os(macOS)

    func testMacOSShowsOpenSafariSettingsButton() {
        let button = app.buttons["Open Safari Settings"]
        XCTAssertTrue(button.waitForExistence(timeout: 5))
    }

    func testMacOSShowsInstructionRows() {
        // Instruction rows are numbered — verify at least the first number appears
        let firstStep = app.staticTexts["1"]
        XCTAssertTrue(
            firstStep.waitForExistence(timeout: 5),
            "macOS should show numbered instruction rows"
        )
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

        // Verify Settings app launched after tap
        let settingsApp = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
        let settingsNavBar = settingsApp.navigationBars.firstMatch
        XCTAssertTrue(
            settingsNavBar.waitForExistence(timeout: 5),
            "Settings app should open after tapping 'Open Settings App'"
        )
    }

    #endif

    // MARK: - Onboarding flow

    func testPhase1DoneTransitionsToWalkthroughThenDismisses() {
        let doneButton = app.buttons["Done \u{2014} show me how to use it"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 5))
        doneButton.tap()

        // After tapping, Phase 2 walkthrough should appear with a Skip button
        let skipButton = app.buttons["Skip"]
        XCTAssertTrue(
            skipButton.waitForExistence(timeout: 5),
            "Walkthrough should appear after completing Phase 1"
        )

        // Skip the walkthrough to dismiss
        skipButton.tap()

        // Settings view should now be visible
        let settingsTitle = app.staticTexts["Reading Speed"]
        XCTAssertTrue(
            settingsTitle.waitForExistence(timeout: 5),
            "Settings view should appear after completing walkthrough"
        )
    }

    func testOnboardingDoesNotAppearWhenAlreadyCompleted() {
        // Terminate and relaunch with onboarding already completed
        app.terminate()

        let completedApp = XCUIApplication()
        completedApp.launchArguments += ["-sr_onboardingPhase", "completed"]
        completedApp.launch()

        // Settings view should be visible immediately, no onboarding sheet
        let settingsTitle = completedApp.staticTexts["Reading Speed"]
        XCTAssertTrue(
            settingsTitle.waitForExistence(timeout: 5),
            "Settings view should appear directly when onboarding is already completed"
        )

        // Onboarding-specific elements should NOT be present
        let openSettingsButton = completedApp.buttons["Open Settings App"]
        let openSafariButton = completedApp.buttons["Open Safari Settings"]
        XCTAssertFalse(openSettingsButton.exists, "Open Settings button should not appear")
        XCTAssertFalse(openSafariButton.exists, "Open Safari Settings button should not appear")
    }
}
