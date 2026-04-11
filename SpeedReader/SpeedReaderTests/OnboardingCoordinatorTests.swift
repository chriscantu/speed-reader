import XCTest

@MainActor
final class OnboardingCoordinatorTests: XCTestCase {
    private func makeDefaults() -> UserDefaults {
        // swiftlint:disable:next force_unwrapping
        UserDefaults(suiteName: "test.\(UUID().uuidString)")!
    }

    // MARK: - Initialization

    func testInitWithFreshDefaultsStartsAtEnableExtension() {
        let coordinator = OnboardingCoordinator(defaults: makeDefaults())
        XCTAssertEqual(coordinator.phase, .enableExtension)
        XCTAssertTrue(coordinator.shouldShowOnboarding)
    }

    func testInitMigratesLegacyOnboarding() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: SettingsKeys.legacyHasCompletedOnboarding)
        let coordinator = OnboardingCoordinator(defaults: defaults)
        XCTAssertEqual(coordinator.phase, .completed)
        XCTAssertFalse(coordinator.shouldShowOnboarding)
    }

    // MARK: - Phase transitions

    func testCompleteEnableExtensionTransitionsToSafariWalkthrough() {
        let defaults = makeDefaults()
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.completeEnableExtension()
        XCTAssertEqual(coordinator.phase, .safariWalkthrough)
        XCTAssertTrue(coordinator.shouldShowOnboarding)
    }

    func testCompleteEnableExtensionPersistsPhase() {
        let defaults = makeDefaults()
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.completeEnableExtension()
        XCTAssertEqual(
            defaults.string(forKey: SettingsKeys.onboardingPhase),
            "safariWalkthrough"
        )
    }

    func testCompleteEnableExtensionGuardsAgainstWrongPhase() {
        let defaults = makeDefaults()
        OnboardingPhase.completed.save(to: defaults)
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.completeEnableExtension()
        XCTAssertEqual(coordinator.phase, .completed, "Should not regress from completed")
    }

    func testCompleteWalkthroughTransitionsToCompleted() {
        let defaults = makeDefaults()
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.completeEnableExtension()
        coordinator.completeWalkthrough()
        XCTAssertEqual(coordinator.phase, .completed)
        XCTAssertFalse(coordinator.shouldShowOnboarding)
    }

    func testCompleteWalkthroughWritesTimestamp() {
        let defaults = makeDefaults()
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.completeEnableExtension()
        coordinator.completeWalkthrough()
        let timestamp = defaults.double(forKey: SettingsKeys.walkthroughCompletedAt)
        XCTAssertGreaterThan(timestamp, 0)
    }

    func testCompleteWalkthroughGuardsAgainstWrongPhase() {
        let defaults = makeDefaults()
        let coordinator = OnboardingCoordinator(defaults: defaults)
        // Still in enableExtension — should not skip to completed
        coordinator.completeWalkthrough()
        XCTAssertEqual(coordinator.phase, .enableExtension, "Should not skip Phase 2")
    }

    // MARK: - Replay

    func testReplayWalkthroughSetsShowingFlag() {
        let defaults = makeDefaults()
        OnboardingPhase.completed.save(to: defaults)
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.replayWalkthrough()
        XCTAssertTrue(coordinator.showingSafariWalkthrough)
    }

    func testReplayWalkthroughIncrementsReplayCount() {
        let defaults = makeDefaults()
        OnboardingPhase.completed.save(to: defaults)
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.replayWalkthrough()
        XCTAssertEqual(defaults.integer(forKey: SettingsKeys.walkthroughReplays), 1)
        coordinator.dismissReplay()
        coordinator.replayWalkthrough()
        XCTAssertEqual(defaults.integer(forKey: SettingsKeys.walkthroughReplays), 2)
    }

    func testReplayWalkthroughGuardsAgainstNonCompletedPhase() {
        let defaults = makeDefaults()
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.replayWalkthrough()
        XCTAssertFalse(coordinator.showingSafariWalkthrough, "Should not replay during onboarding")
    }

    func testDismissReplay() {
        let defaults = makeDefaults()
        OnboardingPhase.completed.save(to: defaults)
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.replayWalkthrough()
        XCTAssertTrue(coordinator.showingSafariWalkthrough)
        coordinator.dismissReplay()
        XCTAssertFalse(coordinator.showingSafariWalkthrough)
    }

    // MARK: - shouldShowOnboarding

    func testShouldShowOnboardingTrueForEnableExtension() {
        let coordinator = OnboardingCoordinator(defaults: makeDefaults())
        XCTAssertTrue(coordinator.shouldShowOnboarding)
    }

    func testShouldShowOnboardingTrueForSafariWalkthrough() {
        let defaults = makeDefaults()
        let coordinator = OnboardingCoordinator(defaults: defaults)
        coordinator.completeEnableExtension()
        XCTAssertTrue(coordinator.shouldShowOnboarding)
    }

    func testShouldShowOnboardingFalseForCompleted() {
        let defaults = makeDefaults()
        OnboardingPhase.completed.save(to: defaults)
        let coordinator = OnboardingCoordinator(defaults: defaults)
        XCTAssertFalse(coordinator.shouldShowOnboarding)
    }
}
