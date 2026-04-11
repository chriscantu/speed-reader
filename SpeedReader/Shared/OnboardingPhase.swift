import Foundation

/// Tracks which onboarding phase the user is in.
/// Phase 1: enable the Safari extension in Settings.
/// Phase 2: learn how to use it in Safari.
enum OnboardingPhase: String {
    case enableExtension
    case safariWalkthrough
    case completed

    /// Read the current phase from UserDefaults. Defaults to `.enableExtension`.
    static func current(from defaults: UserDefaults) -> OnboardingPhase {
        guard let raw = defaults.string(forKey: SettingsKeys.onboardingPhase),
              let phase = OnboardingPhase(rawValue: raw) else {
            return .enableExtension
        }
        return phase
    }

    /// Persist this phase to UserDefaults.
    func save(to defaults: UserDefaults) {
        defaults.set(rawValue, forKey: SettingsKeys.onboardingPhase)
    }

    /// Migrate from the legacy `hasCompletedOnboarding` boolean.
    /// Returns the resolved phase and writes the new key if migrating.
    @discardableResult
    static func migrateIfNeeded(defaults: UserDefaults) -> OnboardingPhase {
        // If the new key already exists, use it
        if defaults.string(forKey: SettingsKeys.onboardingPhase) != nil {
            return current(from: defaults)
        }
        // Legacy migration: if old boolean is true, mark as completed
        if defaults.bool(forKey: "hasCompletedOnboarding") {
            OnboardingPhase.completed.save(to: defaults)
            return .completed
        }
        return .enableExtension
    }

    // MARK: - Funnel tracking

    /// Record the last walkthrough step reached for the given platform.
    static func recordWalkthroughStep(_ step: Int, platform: String, defaults: UserDefaults) {
        let key = platform == "macos"
            ? SettingsKeys.walkthroughLastStepMacOS
            : SettingsKeys.walkthroughLastStepIOS
        defaults.set(step, forKey: key)
    }

    /// Mark the walkthrough as completed with a timestamp and transition to `.completed`.
    static func markWalkthroughCompleted(defaults: UserDefaults) {
        defaults.set(Date().timeIntervalSince1970, forKey: SettingsKeys.walkthroughCompletedAt)
        OnboardingPhase.completed.save(to: defaults)
    }

    /// Increment the replay counter (for re-opens from Settings).
    static func incrementReplayCount(defaults: UserDefaults) {
        let current = defaults.integer(forKey: SettingsKeys.walkthroughReplays)
        defaults.set(current + 1, forKey: SettingsKeys.walkthroughReplays)
    }
}
