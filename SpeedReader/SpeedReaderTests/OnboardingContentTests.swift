import XCTest

final class OnboardingContentTests: XCTestCase {
    private let content = OnboardingContent.current

    // MARK: - Platform-specific instruction content

    #if os(macOS)

    func testMacOSInstructionCount() {
        XCTAssertEqual(content.instructions.count, 4)
    }

    func testMacOSButtonTitle() {
        XCTAssertEqual(content.buttonTitle, "Open Safari Settings")
    }

    func testMacOSHasNoHelperText() {
        XCTAssertNil(content.helperText)
    }

    func testMacOSInstructionsMentionSafari() {
        XCTAssertTrue(
            content.instructions.contains { $0.contains("Safari") },
            "macOS instructions should reference Safari"
        )
    }

    func testMacOSInstructionsMentionExtensions() {
        XCTAssertTrue(
            content.instructions.contains { $0.contains("Extensions") },
            "macOS instructions should reference Extensions"
        )
    }

    func testMacOSUsesClickNotTap() {
        XCTAssertFalse(
            content.instructions.contains { $0.contains("Tap") },
            "macOS instructions should use 'Click', not 'Tap'"
        )
    }

    // MARK: - macOS button action

    func testMacOSSettingsActionOpensSafariExtensionPreferences() {
        XCTAssertEqual(content.settingsAction, .openSafariExtensionPreferences)
    }

    #else

    func testIOSInstructionCount() {
        XCTAssertEqual(content.instructions.count, 5)
    }

    func testIOSButtonTitle() {
        XCTAssertEqual(content.buttonTitle, "Open Settings App")
    }

    func testIOSHasHelperText() {
        XCTAssertNotNil(content.helperText)
    }

    func testIOSHelperTextMentionsBack() {
        XCTAssertTrue(
            content.helperText?.contains("Back") ?? false,
            "iOS helper text should tell users to tap Back"
        )
    }

    func testIOSInstructionsGuideThroughSafariExtensions() {
        XCTAssertTrue(
            content.instructions.contains { $0.contains("Safari") && $0.contains("Extensions") },
            "iOS instructions should guide to Apps → Safari → Extensions"
        )
    }

    func testIOSInstructionsMentionBackNavigation() {
        XCTAssertTrue(
            content.instructions.contains { $0.contains("Back") },
            "iOS instructions should tell users to navigate back"
        )
    }

    func testIOSInstructionsDoNotMentionOpenSafariSettings() {
        XCTAssertFalse(
            content.instructions.contains { $0 == "Open Safari Settings" },
            "iOS instructions should not say 'Open Safari Settings' — that's the macOS flow"
        )
    }

    // MARK: - iOS button action

    func testIOSSettingsActionOpensSystemSettings() {
        XCTAssertEqual(content.settingsAction, .openSystemSettings)
    }

    #endif
}
