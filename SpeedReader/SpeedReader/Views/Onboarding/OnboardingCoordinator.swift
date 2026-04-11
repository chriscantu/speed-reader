import Foundation
import os.log
import SwiftUI

/// State machine that manages onboarding phase transitions.
/// Drives which onboarding view is displayed in ContentView.
@MainActor
@Observable
final class OnboardingCoordinator {
    private let defaults: UserDefaults

    private(set) var phase: OnboardingPhase
    private(set) var showingSafariWalkthrough = false

    init(defaults: UserDefaults? = nil) {
        let store: UserDefaults
        if let injected = defaults {
            store = injected
        } else if let groupDefaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
            store = groupDefaults
        } else {
            os_log(
                .error,
                "[SpeedReader] App Group defaults unavailable — onboarding state will not sync with extension"
            )
            store = .standard
        }
        self.defaults = store
        self.phase = OnboardingPhase.migrateIfNeeded(defaults: store)
    }

    /// Transition from Phase 1 to Phase 2.
    func completeEnableExtension() {
        guard phase == .enableExtension else { return }
        phase = .safariWalkthrough
        phase.save(to: defaults)
    }

    /// Complete the walkthrough (Phase 2 → completed).
    func completeWalkthrough() {
        guard phase == .safariWalkthrough else { return }
        OnboardingPhase.markWalkthroughCompleted(defaults: defaults)
        phase = .completed
    }

    /// Record which step the user reached in the walkthrough.
    func recordStep(_ step: Int) {
        #if os(macOS)
        let platform = OnboardingPhase.Platform.macos
        #else
        let platform = OnboardingPhase.Platform.ios
        #endif
        OnboardingPhase.recordWalkthroughStep(step, platform: platform, defaults: defaults)
    }

    /// Show the walkthrough again from Settings (replay).
    func replayWalkthrough() {
        guard phase == .completed else { return }
        OnboardingPhase.incrementReplayCount(defaults: defaults)
        showingSafariWalkthrough = true
    }

    /// Dismiss the replay walkthrough sheet.
    func dismissReplay() {
        showingSafariWalkthrough = false
    }

    /// Whether the main onboarding flow should be shown (Phase 1 or 2).
    var shouldShowOnboarding: Bool {
        phase != .completed
    }
}
