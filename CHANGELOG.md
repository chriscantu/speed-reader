# Changelog

## v1.1.0 (2026-04-11)

- Add phased onboarding walkthrough: Phase 1 guides enabling the Safari extension, Phase 2 is a 4-step wizard showing how to use SpeedReader in Safari
- Platform-specific views for iOS (swipeable pages) and macOS (stepped navigation with Back button)
- Stylized SwiftUI diagrams (Safari address bar, toolbar, extension menu, RSVP preview)
- On-device funnel tracking via App Group UserDefaults (phase, step, completion, replays, first activation)
- "How to Use in Safari" button in Settings replays the walkthrough
- First extension activation detection via native messaging bridge
- Backward-compatible migration from legacy onboarding boolean

## v1.0.5 (2026-04-11)

- Use build_mac_app for macOS builds instead of build_app

## v1.0.4 (2026-04-11)

- Fix macOS build: separate output dirs, use pkg for macOS uploads

## v1.0.3 (2026-04-11)

- Build and upload both iOS and macOS platforms in fastlane lanes

## v1.0.2 (2026-04-11)

- Disable IAP precheck in upload_to_app_store (not supported with API key)

## v1.0.1 (2026-04-11)

- Set up fastlane for automated App Store and TestFlight distribution (#52)

