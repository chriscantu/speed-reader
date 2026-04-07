import os.log
import SafariServices

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem else {
            os_log(.error, "[SpeedReader] No input items in extension context")
            context.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        guard let messageDict = item.userInfo?[SFExtensionMessageKey] as? [String: Any],
              let action = messageDict["action"] as? String else {
            os_log(.error, "[SpeedReader] Invalid message format")
            context.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        os_log(.default, "[SpeedReader] Received action: %{public}@", action)

        let response = NSExtensionItem()

        switch action {
        case "getSettings":
            let settings = loadSettingsFromAppGroup()
            response.userInfo = [SFExtensionMessageKey: settings]

        case "saveSettings":
            if let settingsData = messageDict["settings"] as? [String: Any] {
                let savedCount = saveSettingsToAppGroup(settingsData)
                response.userInfo = [SFExtensionMessageKey: ["status": "ok", "savedCount": savedCount]]
            } else {
                os_log(.error, "[SpeedReader] saveSettings called without valid 'settings' key")
                response.userInfo = [SFExtensionMessageKey: ["error": "Missing or invalid settings payload"]]
            }

        case "ping":
            response.userInfo = [SFExtensionMessageKey: ["status": "ok", "version": "1.0.0"]]

        default:
            os_log(.default, "[SpeedReader] Unknown action: %{public}@", action)
            response.userInfo = [SFExtensionMessageKey: ["error": "Unknown action"]]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    private func loadSettingsFromAppGroup() -> [String: Any] {
        guard let defaults = UserDefaults(suiteName: SettingsKeys.appGroupID) else {
            os_log(.error, "[SpeedReader] App Group not available for reading settings")
            return defaultSettings()
        }

        return [
            "wpm": defaults.object(forKey: SettingsKeys.wpm) ?? SettingsKeys.Defaults.wpm,
            "font": defaults.string(forKey: SettingsKeys.font) ?? SettingsKeys.Defaults.font.rawValue,
            "theme": defaults.string(forKey: SettingsKeys.theme) ?? SettingsKeys.Defaults.theme.rawValue,
            "fontSize": defaults.object(forKey: SettingsKeys.fontSize) ?? SettingsKeys.Defaults.fontSize,
            "punctuationPause": defaults.object(forKey: SettingsKeys.punctuationPause)
                ?? SettingsKeys.Defaults.punctuationPause,
            "alignment": defaults.string(forKey: SettingsKeys.alignment)
                ?? SettingsKeys.Defaults.alignment.rawValue,
            "chunkSize": defaults.object(forKey: SettingsKeys.chunkSize)
                ?? SettingsKeys.Defaults.chunkSize,
        ]
    }

    /// Saves settings to App Group UserDefaults. Returns the number of fields that matched expected types.
    @discardableResult
    private func saveSettingsToAppGroup(_ settings: [String: Any]) -> Int {
        guard let defaults = UserDefaults(suiteName: SettingsKeys.appGroupID) else {
            os_log(.error, "[SpeedReader] App Group not available for saving settings")
            return 0
        }
        return SettingsKeys.saveSettings(settings, to: defaults)
    }

    private func defaultSettings() -> [String: Any] {
        [
            "wpm": SettingsKeys.Defaults.wpm,
            "font": SettingsKeys.Defaults.font.rawValue,
            "theme": SettingsKeys.Defaults.theme.rawValue,
            "fontSize": SettingsKeys.Defaults.fontSize,
            "punctuationPause": SettingsKeys.Defaults.punctuationPause,
            "alignment": SettingsKeys.Defaults.alignment.rawValue,
            "chunkSize": SettingsKeys.Defaults.chunkSize,
        ]
    }
}
