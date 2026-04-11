import SwiftUI

struct ContentView: View {
    @Environment(ReaderSettings.self) private var settings
    @State private var coordinator = OnboardingCoordinator()

    var body: some View {
        NavigationStack {
            SettingsView()
                .environment(coordinator)
                .sheet(isPresented: Binding(
                    get: { coordinator.shouldShowOnboarding },
                    set: { _ in }
                )) {
                    onboardingSheet
                        .interactiveDismissDisabled()
                }
                .sheet(isPresented: Binding(
                    get: { coordinator.showingSafariWalkthrough },
                    set: { if !$0 { coordinator.dismissReplay() } }
                )) {
                    walkthroughSheet(isReplay: true)
                }
        }
    }

    @ViewBuilder
    private var onboardingSheet: some View {
        switch coordinator.phase {
        case .enableExtension:
            enableExtensionView
        case .safariWalkthrough:
            walkthroughSheet(isReplay: false)
        case .completed:
            EmptyView()
        }
    }

    @ViewBuilder
    private var enableExtensionView: some View {
        #if os(macOS)
        EnableExtensionViewMacOS(onComplete: {
            coordinator.completeEnableExtension()
        })
        #else
        EnableExtensionViewIOS(onComplete: {
            coordinator.completeEnableExtension()
        })
        #endif
    }

    @ViewBuilder
    private func walkthroughSheet(isReplay: Bool) -> some View {
        #if os(macOS)
        SafariWalkthroughViewMacOS(
            onComplete: {
                if isReplay {
                    coordinator.dismissReplay()
                } else {
                    coordinator.completeWalkthrough()
                }
            },
            isReplay: isReplay
        )
        .environment(coordinator)
        #else
        SafariWalkthroughViewIOS(
            onComplete: {
                if isReplay {
                    coordinator.dismissReplay()
                } else {
                    coordinator.completeWalkthrough()
                }
            },
            isReplay: isReplay
        )
        .environment(coordinator)
        #endif
    }
}
