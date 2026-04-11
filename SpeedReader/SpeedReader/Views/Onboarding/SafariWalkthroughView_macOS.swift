#if os(macOS)
import SwiftUI

/// Phase 2 walkthrough for macOS: 4-step wizard showing how to use SpeedReader in Safari.
struct SafariWalkthroughView_macOS: View {
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

            // Step content
            Group {
                switch currentStep {
                case 0: step1
                case 1: step2
                case 2: step3
                case 3: step4
                default: step1
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onChange(of: currentStep) { _, newStep in
                if !isReplay {
                    coordinator?.recordStep(newStep)
                }
            }

            // Navigation buttons
            HStack {
                if currentStep > 0 {
                    Button("Back") {
                        withAnimation { currentStep -= 1 }
                    }
                    .foregroundStyle(.secondary)
                }
                Spacer()
                Button(currentStep < totalSteps - 1 ? "Next" : "Got it") {
                    if currentStep < totalSteps - 1 {
                        withAnimation { currentStep += 1 }
                    } else {
                        onComplete()
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .frame(minWidth: 400, minHeight: 450)
    }

    // MARK: - Steps

    private var step1: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "safari")
                .font(.system(size: 56))
                .foregroundStyle(Color.accentColor)
            Text("Open Safari")
                .font(.title2).fontWeight(.semibold)
            Text("Navigate to any article or web page you'd like to read")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step2: some View {
        VStack(spacing: 24) {
            Spacer()
            SafariToolbar()
                .padding(.horizontal, 24)
            Text("Find extensions in the toolbar")
                .font(.title2).fontWeight(.semibold)
            Text("Look for the extensions area to the right of the address bar")
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
            Text("Click SpeedReader")
                .font(.title2).fontWeight(.semibold)
            Text("Click the red SpeedReader icon \u{2014} the page content will load into the speed reader")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step4: some View {
        VStack(spacing: 24) {
            Spacer()
            RSVPOverlayPreview(showKeyboardHints: true)
                .padding(.horizontal, 32)
            Text("Start reading!")
                .font(.title2).fontWeight(.semibold)
            Text("Press Space to pause. Use \u{2190} \u{2192} to navigate between sentences.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }
}
#endif
