# Crash Reporting Integration — Design Spec

Date: 2026-04-09
ADR: [ADR #0001](https://github.com/chriscantu/speed-reader/wiki/ADR-0001-Crash-Reporting-Strategy)
Issue: [#49](https://github.com/chriscantu/speed-reader/issues/49)

## Overview

Add crash and error visibility to SpeedReader using Apple-native crash reporting for Swift and custom JS error capture for the extension — zero third-party dependencies, zero PII collection, zero cost.

## Architecture

Two independent subsystems, one for each crash domain:

```
┌─────────────────────────────┐    ┌──────────────────────────────────┐
│  Native (Swift)             │    │  Extension (JavaScript)           │
│                             │    │                                    │
│  Xcode Organizer            │    │  error-reporter.js                 │
│    └─ crash reports (auto)  │    │    ├─ window.onerror               │
│                             │    │    ├─ unhandledrejection            │
│  MetricKit                  │    │    ├─ self.onerror (background)     │
│    └─ MXMetricManager       │    │    └─ reportError() (explicit)      │
│       Subscriber            │    │              │                      │
│       └─ os_log             │    │              ▼                      │
│                             │    │  browser.storage.local (50 cap)     │
│                             │    │              │                      │
│                             │    │  sendNativeMessage()                │
│                             │    │              │                      │
└─────────────────────────────┘    └──────────────┼─────────────────────┘
                                                  │
                                                  ▼
                                   ┌──────────────────────────────────┐
                                   │  SafariWebExtensionHandler.swift  │
                                   │    └─ os_log (category: JSError)  │
                                   └──────────────────────────────────┘
```

## Section 1: Native Crash Reporting (Apple-native)

Rely entirely on Apple's built-in infrastructure.

**Xcode Organizer**: Already collects crash reports from users who opt in to sharing diagnostics with developers. Stack traces, OS version, device model. No integration work required.

**MetricKit**: Add an `MXMetricManagerSubscriber` in the container app to receive daily diagnostic payloads including crash diagnostics (`MXCrashDiagnostic`), hang rate, and disk/memory warnings. Payloads are logged via `os_log`.

MetricKit lives in the container app only. Extension process crashes surface through Organizer but MetricKit payloads are delivered to the app process.

### What we're NOT doing

No custom symbolication pipeline, no remote dashboard, no third-party SDK. Apple handles aggregation and anonymization.

## Section 2: JS Error Capture in the Extension

A lightweight error capture module that intercepts uncaught errors and unhandled promise rejections in the extension's JS, then persists them to `browser.storage.local`.

### Error interceptors

A small module (`error-reporter.js`) that registers:

- `window.addEventListener('error', ...)` — catches uncaught exceptions in content.js / overlay.js
- `window.addEventListener('unhandledrejection', ...)` — catches unhandled promise rejections
- Exported `reportError(error, context)` function for explicit try-catch reporting in critical paths

### Error payload

Each captured error is a plain object:

| Field | Description | Privacy |
|-------|-------------|---------|
| `timestamp` | ISO 8601 | Safe |
| `message` | Error message string | Safe |
| `stack` | Stack trace, if available | Safe (our own code paths) |
| `source` | Which script: `content`, `background`, `overlay` | Safe |
| `url` | Page hostname only — no path, no query params | PII-safe |
| `userAgent` | OS/browser version for correlation | Safe |

### Storage

Errors write to `browser.storage.local` under key `errorLog`. Capped at the most recent 50 entries (FIFO) to avoid unbounded growth.

### Background script coverage

`background.js` runs in a service worker context where `window` isn't available. It gets its own `self.addEventListener('error', ...)` and `self.addEventListener('unhandledrejection', ...)`.

## Section 3: Bridging JS Errors to Native Logging

Getting JS error data from `browser.storage.local` across to `os_log` on the native side so errors appear in Console.app.

### Message-based bridge

1. When the extension captures an error, it sends a native message via `browser.runtime.sendNativeMessage()` to `SafariWebExtensionHandler.swift` with message type `"jsError"`
2. `SafariWebExtensionHandler` receives the message, extracts the error payload, and writes it to `os_log` with category `"JSError"` and type `.error`
3. Log format — structured for Console.app filtering:
   ```
   [SpeedReader:JSError] content.js — TypeError: Cannot read property 'textContent' of null
   Stack: content.js:142:12 → extractText:128:5
   Host: example.com
   ```
4. Fire-and-forget — the JS side sends the message and doesn't wait for a response. If the native handler isn't available, the error remains in `browser.storage.local` as a fallback.

### Why not App Group directly?

The JS side can't write to the App Group — only native Swift code can. `browser.storage.local` is the extension's own storage, so we need the message bridge to cross that boundary.

## Section 4: Privacy Guarantees

**Privacy manifests unchanged**: Both `PrivacyInfo.xcprivacy` files remain as-is — `NSPrivacyCollectedDataTypes` stays empty. All error data is local-only (on-device `os_log` + `browser.storage.local`). No network transmission.

**PII scrubbing in JS error payloads**:
- Page URL → hostname only (`example.com`), no path or query params
- No user settings, no reading content, no identifiers
- Stack traces contain only extension bundle file paths (our own code)

**No new App Store privacy nutrition label entries** required since no data leaves the device.

## Section 5: Testing Strategy

### MetricKit (native)

- Unit test that `MXMetricManagerSubscriber` is registered on app launch
- Unit test that the subscriber's `didReceive(_:)` handler correctly formats and logs crash diagnostics via `os_log`

### JS error capture

- Unit tests for `error-reporter.js`: verify `window.onerror` and `unhandledrejection` handlers capture errors in correct payload format
- Test FIFO cap: write 55 errors, verify only 50 are stored
- Test PII scrubbing: verify full URLs are stripped to hostname only
- Test `reportError()` explicit capture for try-catch usage
- Test background script handlers (`self.addEventListener` variants)

### Native bridge

- Unit test that `SafariWebExtensionHandler` correctly parses a JS error message payload and writes to `os_log`
- Test malformed/missing fields don't crash the handler (defensive parsing)
- Test unknown message types are handled gracefully

### Integration (automated)

- Safari regression test (using existing Safari driver in `scripts/lib/`) that triggers a JS error on a test page and verifies the error appears in `browser.storage.local` with the expected payload shape
- End-to-end test that sends a native message with an error payload and verifies `SafariWebExtensionHandler` processes it without error

### Manual only (what genuinely can't be automated)

- Verifying `os_log` output appears correctly in Console.app (no programmatic way to read `os_log` in a sandboxed test)
- MetricKit payload delivery (Apple controls the 24h delivery schedule)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `SpeedReader/SpeedReaderExtension/Resources/error-reporter.js` | Create | JS error capture module |
| `SpeedReader/SpeedReaderExtension/Resources/background.js` | Modify | Import error reporter, register service worker handlers |
| `SpeedReader/SpeedReaderExtension/Resources/content.js` | Modify | Import error reporter, register window handlers |
| `SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift` | Modify | Handle JS error messages, log via os_log |
| `SpeedReader/SpeedReader/SpeedReaderApp.swift` | Modify | Register MXMetricManagerSubscriber |
| `SpeedReader/SpeedReader/Models/CrashDiagnosticsSubscriber.swift` | Create | MetricKit subscriber implementation |
| `tests/js/error-reporter.test.js` | Create | JS error capture unit tests |
| `tests/swift/CrashDiagnosticsSubscriberTests.swift` | Create | MetricKit subscriber tests |
