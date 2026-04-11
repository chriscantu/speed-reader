import Foundation

/// Tracks which onboarding phase the user is in.
/// Phase 1: enable the Safari extension in Settings.
/// Phase 2: learn how to use it in Safari.
enum OnboardingPhase: String {
    case enableExtension
    case safariWalkthrough
    case completed

    /// Platform discriminator for funnel tracking keys.
    enum Platform {
        case ios, macos

        var walkthroughStepKey: String {
            switch self {
            case .ios: return SettingsKeys.walkthroughLastStepIOS
            case .macos: return SettingsKeys.walkthroughLastStepMacOS
            }
        }
    }

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
    /// If the new key already exists, returns its value.
    /// If the legacy key is true, writes `.completed` to the new key and returns it.
    /// Otherwise returns `.enableExtension` without writing (the default for fresh installs).
    @discardableResult
    static func migrateIfNeeded(defaults: UserDefaults) -> OnboardingPhase {
        // If the new key already exists, use it
        if defaults.string(forKey: SettingsKeys.onboardingPhase) != nil {
            return current(from: defaults)
        }
        // Legacy migration: if old boolean is true, mark as completed
        if defaults.bool(forKey: SettingsKeys.legacyHasCompletedOnboarding) {
            OnboardingPhase.completed.save(to: defaults)
            return .completed
        }
        return .enableExtension
    }

    // MARK: - Funnel tracking

    /// Record the last walkthrough step reached for the given platform.
    static func recordWalkthroughStep(_ step: Int, platform: Platform, defaults: UserDefaults) {
        defaults.set(step, forKey: platform.walkthroughStepKey)
    }

    /// Record the walkthrough completed timestamp and persist the `.completed` phase to UserDefaults.
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
