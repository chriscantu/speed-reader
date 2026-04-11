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

    // MARK: - Phase 2 walkthrough (functional)

    func testWalkthroughShowsAllFourSteps() {
        // Transition to Phase 2
        let doneButton = app.buttons["Done \u{2014} show me how to use it"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 5))
        doneButton.tap()

        // Step 1: Open Safari
        let step1Title = app.staticTexts["Open Safari"]
        XCTAssertTrue(
            step1Title.waitForExistence(timeout: 5),
            "Step 1 should show 'Open Safari'"
        )

        // Advance to step 2
        let nextButton = app.buttons["Next"]
        XCTAssertTrue(nextButton.waitForExistence(timeout: 5))
        nextButton.tap()

        #if os(macOS)
        // Step 2 macOS: toolbar diagram
        let step2Title = app.staticTexts["Find extensions in the toolbar"]
        XCTAssertTrue(
            step2Title.waitForExistence(timeout: 5),
            "Step 2 macOS should show toolbar instructions"
        )
        #else
        // Step 2 iOS: puzzle piece
        let step2Title = app.staticTexts["Tap the puzzle piece"]
        XCTAssertTrue(
            step2Title.waitForExistence(timeout: 5),
            "Step 2 iOS should show puzzle piece instructions"
        )
        #endif

        // Advance to step 3
        nextButton.tap()

        #if os(macOS)
        let step3Title = app.staticTexts["Click SpeedReader"]
        #else
        let step3Title = app.staticTexts["Tap SpeedReader"]
        #endif
        XCTAssertTrue(
            step3Title.waitForExistence(timeout: 5),
            "Step 3 should show SpeedReader activation instructions"
        )

        // Advance to step 4
        nextButton.tap()

        #if os(macOS)
        let step4Title = app.staticTexts["Start reading!"]
        #else
        let step4Title = app.staticTexts["You're reading!"]
        #endif
        XCTAssertTrue(
            step4Title.waitForExistence(timeout: 5),
            "Step 4 should show reading confirmation"
        )

        // Final button should say "Got it"
        let gotItButton = app.buttons["Got it"]
        XCTAssertTrue(gotItButton.exists, "Final step should show 'Got it' button")
        gotItButton.tap()

        // Settings view should now be visible
        let settingsTitle = app.staticTexts["Reading Speed"]
        XCTAssertTrue(
            settingsTitle.waitForExistence(timeout: 5),
            "Settings view should appear after completing walkthrough"
        )
    }

    func testWalkthroughSkipButtonDismisses() {
        // Transition to Phase 2
        let doneButton = app.buttons["Done \u{2014} show me how to use it"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 5))
        doneButton.tap()

        // Skip should be visible
        let skipButton = app.buttons["Skip"]
        XCTAssertTrue(skipButton.waitForExistence(timeout: 5))
        skipButton.tap()

        // Settings view should be visible
        let settingsTitle = app.staticTexts["Reading Speed"]
        XCTAssertTrue(
            settingsTitle.waitForExistence(timeout: 5),
            "Settings should appear after skipping walkthrough"
        )
    }

    #if os(macOS)
    func testWalkthroughBackButtonNavigatesBackward() {
        // Transition to Phase 2
        let doneButton = app.buttons["Done \u{2014} show me how to use it"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 5))
        doneButton.tap()

        // Advance to step 2
        let nextButton = app.buttons["Next"]
        XCTAssertTrue(nextButton.waitForExistence(timeout: 5))
        nextButton.tap()

        // Back button should appear on step 2
        let backButton = app.buttons["Back"]
        XCTAssertTrue(
            backButton.waitForExistence(timeout: 5),
            "Back button should appear on step 2+"
        )
        backButton.tap()

        // Should return to step 1
        let step1Title = app.staticTexts["Open Safari"]
        XCTAssertTrue(
            step1Title.waitForExistence(timeout: 5),
            "Should return to step 1 after tapping Back"
        )
    }
    #endif

    func testHowToUseButtonReplaysWalkthrough() {
        // Complete onboarding first
        app.terminate()
        let completedApp = XCUIApplication()
        completedApp.launchArguments += ["-sr_onboardingPhase", "completed"]
        completedApp.launch()

        // Tap "How to Use in Safari" button
        let howToUseButton = completedApp.buttons["How to Use in Safari"]
        XCTAssertTrue(
            howToUseButton.waitForExistence(timeout: 5),
            "How to Use button should be in Settings"
        )
        howToUseButton.tap()

        // Walkthrough should appear as a replay
        let skipButton = completedApp.buttons["Skip"]
        XCTAssertTrue(
            skipButton.waitForExistence(timeout: 5),
            "Walkthrough replay should appear"
        )

        // Dismiss the replay
        skipButton.tap()

        // Settings should be visible again
        let settingsTitle = completedApp.staticTexts["Reading Speed"]
        XCTAssertTrue(
            settingsTitle.waitForExistence(timeout: 5),
            "Settings should reappear after dismissing replay"
        )
    }

    // MARK: - Completed state

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
