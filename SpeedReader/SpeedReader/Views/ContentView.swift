import SwiftUI

struct ContentView: View {
    @Environment(ReaderSettings.self) private var settings
    @State private var extensionEnabled = false
    @State private var hasCheckedExtension = false

    var body: some View {
        NavigationStack {
            if hasCheckedExtension && extensionEnabled {
                SettingsView()
            } else {
                OnboardingView(
                    extensionEnabled: $extensionEnabled,
                    hasChecked: $hasCheckedExtension
                )
            }
        }
    }
}
