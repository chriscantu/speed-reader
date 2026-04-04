# SpeedReader Manual Regression Checklist

> Run `make test-regression` first. This checklist covers what automation cannot.

## iOS (iPhone)

- [ ] Overlay opens from extension icon
- [ ] Tap anywhere on word area toggles play/pause
- [ ] Swipe-friendly: controls have large tap targets
- [ ] WPM slider works with touch drag
- [ ] Theme follows system (toggle device dark mode)
- [ ] OpenDyslexic font renders correctly
- [ ] Context preview shows on pause
- [ ] Close button dismisses overlay
- [ ] Toast messages appear and auto-dismiss

## iPadOS

- [ ] All iOS checks above pass
- [ ] Keyboard shortcuts work with external keyboard (Space, arrows, Escape)
- [ ] Split View / Slide Over does not break overlay layout
- [ ] Overlay respects safe areas in all orientations

## macOS — Gaps Not Covered by Automation

- [ ] VoiceOver reads all controls and word area
- [ ] Slider is draggable with mouse (not just programmatic set)
- [ ] Overlay appears correctly in both standard and full-screen Safari
- [ ] Extension icon shows correct state (no stale badge)
