import SwiftUI

struct ContentView: View {
    @Environment(ReaderSettings.self) private var settings
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @State private var showingOnboarding = false

    var body: some View {
        NavigationStack {
            SettingsView()
                .sheet(isPresented: $showingOnboarding) {
                    OnboardingView(onComplete: {
                        hasCompletedOnboarding = true
                        showingOnboarding = false
                    })
                }
        }
        .onAppear {
            if !hasCompletedOnboarding {
                showingOnboarding = true
            }
        }
    }
}
