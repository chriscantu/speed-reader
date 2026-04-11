import Foundation
import SwiftUI

/// Observable object that manages onboarding phase state transitions.
/// Drives which onboarding view is displayed in ContentView.
@Observable
final class OnboardingCoordinator {
    private let defaults: UserDefaults

    private(set) var phase: OnboardingPhase
    var showingSafariWalkthrough = false

    init(defaults: UserDefaults? = nil) {
        let store: UserDefaults
        if let injected = defaults {
            store = injected
        } else if let groupDefaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
            store = groupDefaults
        } else {
            store = .standard
        }
        self.defaults = store
        self.phase = OnboardingPhase.migrateIfNeeded(defaults: store)
    }

    /// Transition from Phase 1 to Phase 2.
    func completeEnableExtension() {
        phase = .safariWalkthrough
        phase.save(to: defaults)
    }

    /// Complete the walkthrough (Phase 2 → completed).
    func completeWalkthrough() {
        OnboardingPhase.markWalkthroughCompleted(defaults: defaults)
        phase = .completed
    }

    /// Record which step the user reached in the walkthrough.
    func recordStep(_ step: Int) {
        #if os(macOS)
        let platform = "macos"
        #else
        let platform = "ios"
        #endif
        OnboardingPhase.recordWalkthroughStep(step, platform: platform, defaults: defaults)
    }

    /// Show the walkthrough again from Settings (replay).
    func replayWalkthrough() {
        OnboardingPhase.incrementReplayCount(defaults: defaults)
        showingSafariWalkthrough = true
    }

    /// Whether the main onboarding flow should be shown (Phase 1 or 2).
    var shouldShowOnboarding: Bool {
        phase != .completed
    }
}
