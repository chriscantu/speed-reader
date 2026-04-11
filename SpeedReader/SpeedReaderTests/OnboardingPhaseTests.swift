import XCTest

final class OnboardingPhaseTests: XCTestCase {
    private func makeDefaults() -> UserDefaults {
        // swiftlint:disable:next force_unwrapping
        UserDefaults(suiteName: "test.\(UUID().uuidString)")!
    }

    // MARK: - Phase read/write

    func testDefaultPhaseIsEnableExtension() {
        let defaults = makeDefaults()
        let phase = OnboardingPhase.current(from: defaults)
        XCTAssertEqual(phase, .enableExtension)
    }

    func testWriteAndReadPhase() {
        let defaults = makeDefaults()
        OnboardingPhase.safariWalkthrough.save(to: defaults)
        XCTAssertEqual(OnboardingPhase.current(from: defaults), .safariWalkthrough)
    }

    func testCompletedPhase() {
        let defaults = makeDefaults()
        OnboardingPhase.completed.save(to: defaults)
        XCTAssertEqual(OnboardingPhase.current(from: defaults), .completed)
    }

    // MARK: - Backward compatibility migration

    func testMigrationFromLegacyOnboarding() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: "hasCompletedOnboarding")
        let phase = OnboardingPhase.migrateIfNeeded(defaults: defaults)
        XCTAssertEqual(phase, .completed)
        XCTAssertEqual(OnboardingPhase.current(from: defaults), .completed)
    }

    func testNoMigrationWhenNewKeyExists() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: "hasCompletedOnboarding")
        OnboardingPhase.safariWalkthrough.save(to: defaults)
        let phase = OnboardingPhase.migrateIfNeeded(defaults: defaults)
        XCTAssertEqual(phase, .safariWalkthrough)
    }

    func testNoMigrationWhenLegacyKeyIsFalse() {
        let defaults = makeDefaults()
        defaults.set(false, forKey: "hasCompletedOnboarding")
        let phase = OnboardingPhase.migrateIfNeeded(defaults: defaults)
        XCTAssertEqual(phase, .enableExtension)
    }

    // MARK: - Funnel tracking

    func testRecordWalkthroughStep() {
        let defaults = makeDefaults()
        OnboardingPhase.recordWalkthroughStep(2, platform: "ios", defaults: defaults)
        let step = defaults.integer(forKey: SettingsKeys.walkthroughLastStepIOS)
        XCTAssertEqual(step, 2)
    }

    func testRecordWalkthroughStepMacOS() {
        let defaults = makeDefaults()
        OnboardingPhase.recordWalkthroughStep(3, platform: "macos", defaults: defaults)
        let step = defaults.integer(forKey: SettingsKeys.walkthroughLastStepMacOS)
        XCTAssertEqual(step, 3)
    }

    func testMarkWalkthroughCompleted() {
        let defaults = makeDefaults()
        OnboardingPhase.markWalkthroughCompleted(defaults: defaults)
        let timestamp = defaults.double(forKey: SettingsKeys.walkthroughCompletedAt)
        XCTAssertGreaterThan(timestamp, 0)
        XCTAssertEqual(OnboardingPhase.current(from: defaults), .completed)
    }

    func testIncrementReplayCount() {
        let defaults = makeDefaults()
        OnboardingPhase.incrementReplayCount(defaults: defaults)
        XCTAssertEqual(defaults.integer(forKey: SettingsKeys.walkthroughReplays), 1)
        OnboardingPhase.incrementReplayCount(defaults: defaults)
        XCTAssertEqual(defaults.integer(forKey: SettingsKeys.walkthroughReplays), 2)
    }
}
