import SafariServices
import os.log

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
                saveSettingsToAppGroup(settingsData)
            }
            response.userInfo = [SFExtensionMessageKey: ["status": "ok"]]

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
            "punctuationPause": defaults.object(forKey: SettingsKeys.punctuationPause) ?? SettingsKeys.Defaults.punctuationPause,
        ]
    }

    private func saveSettingsToAppGroup(_ settings: [String: Any]) {
        guard let defaults = UserDefaults(suiteName: SettingsKeys.appGroupID) else {
            os_log(.error, "[SpeedReader] App Group not available for saving settings")
            return
        }

        if let wpm = settings["wpm"] as? Int {
            defaults.set(SettingsKeys.clamp(wpm, min: SettingsKeys.wpmMin, max: SettingsKeys.wpmMax),
                         forKey: SettingsKeys.wpm)
        }
        if let font = settings["font"] as? String {
            defaults.set(font, forKey: SettingsKeys.font)
        }
        if let theme = settings["theme"] as? String {
            defaults.set(theme, forKey: SettingsKeys.theme)
        }
        if let fontSize = settings["fontSize"] as? Int {
            defaults.set(SettingsKeys.clamp(fontSize, min: SettingsKeys.fontSizeMin, max: SettingsKeys.fontSizeMax),
                         forKey: SettingsKeys.fontSize)
        }
        if let punctuationPause = settings["punctuationPause"] as? Bool {
            defaults.set(punctuationPause, forKey: SettingsKeys.punctuationPause)
        }
    }

    private func defaultSettings() -> [String: Any] {
        [
            "wpm": SettingsKeys.Defaults.wpm,
            "font": SettingsKeys.Defaults.font.rawValue,
            "theme": SettingsKeys.Defaults.theme.rawValue,
            "fontSize": SettingsKeys.Defaults.fontSize,
            "punctuationPause": SettingsKeys.Defaults.punctuationPause,
        ]
    }
}
