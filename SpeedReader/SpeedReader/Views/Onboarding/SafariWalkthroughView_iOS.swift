#if os(iOS)
import SwiftUI

/// Phase 2 walkthrough for iOS: 4-step wizard showing how to use SpeedReader in Safari.
struct SafariWalkthroughView_iOS: View {
    var onComplete: () -> Void
    var isReplay: Bool = false

    @State private var currentStep = 0
    @Environment(OnboardingCoordinator.self) private var coordinator: OnboardingCoordinator?

    private let totalSteps = 4

    var body: some View {
        VStack(spacing: 0) {
            // Header: progress + skip
            HStack {
                HStack(spacing: 6) {
                    ForEach(0..<totalSteps, id: \.self) { step in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(step <= currentStep ? Color.accentColor : Color.secondary.opacity(0.3))
                            .frame(width: 28, height: 4)
                    }
                }
                Spacer()
                Button("Skip") { onComplete() }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)

            // Paged content
            TabView(selection: $currentStep) {
                step1.tag(0)
                step2.tag(1)
                step3.tag(2)
                step4.tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .onChange(of: currentStep) { _, newStep in
                if !isReplay {
                    coordinator?.recordStep(newStep)
                }
            }

            // Bottom button
            Button(currentStep < totalSteps - 1 ? "Next" : "Got it") {
                if currentStep < totalSteps - 1 {
                    withAnimation { currentStep += 1 }
                } else {
                    onComplete()
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
    }

    // MARK: - Steps

    private var step1: some View {
        walkthroughStep(
            icon: Image(systemName: "safari").font(.system(size: 56)),
            title: "Open Safari",
            subtitle: "Navigate to any article or web page you'd like to read"
        )
    }

    private var step2: some View {
        VStack(spacing: 24) {
            Spacer()
            SafariAddressBar()
                .padding(.horizontal, 32)
            Text("Tap the puzzle piece")
                .font(.title2).fontWeight(.semibold)
            Text("It's in the address bar \u{2014} this opens your extensions")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step3: some View {
        VStack(spacing: 24) {
            Spacer()
            ExtensionMenu()
                .padding(.horizontal, 40)
            Text("Tap SpeedReader")
                .font(.title2).fontWeight(.semibold)
            Text("Look for the red icon \u{2014} the page content will load into the speed reader")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step4: some View {
        VStack(spacing: 24) {
            Spacer()
            RSVPOverlayPreview(showKeyboardHints: false)
                .padding(.horizontal, 32)
            Text("You're reading!")
                .font(.title2).fontWeight(.semibold)
            Text("Tap anywhere to pause. Use \u{2039} \u{203A} to skip between sentences.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private func walkthroughStep(icon: Image, title: String, subtitle: String) -> some View {
        VStack(spacing: 24) {
            Spacer()
            icon.foregroundStyle(Color.accentColor)
            Text(title)
                .font(.title2).fontWeight(.semibold)
            Text(subtitle)
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }
}
#endif
