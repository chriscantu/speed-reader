# Contributing to SpeedReader

Thanks for your interest in contributing. SpeedReader is an accessibility tool — every change should be evaluated through the lens of neurodivergent users who depend on it.

## Prerequisites

- **Xcode 16+** (with iOS 17+ and macOS 14+ SDKs)
- **Node.js 20+** (for JavaScript tests and linting)
- **SwiftLint** — install via `brew install swiftlint`

## Getting Started

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/ios-speed-reader.git
cd ios-speed-reader

# Install JS dev dependencies (ESLint, test runner)
npm install

# Open the Xcode project
open SpeedReader/SpeedReader.xcodeproj
```

Build and run with **Cmd+R** in Xcode. After the first run, enable the extension in Safari:

- **iOS/iPadOS**: Settings > Apps > Safari > Extensions > SpeedReader
- **Mac**: Safari > Settings > Extensions > SpeedReader

## Project Structure

```
SpeedReader/SpeedReader/          # SwiftUI container app
SpeedReader/SpeedReaderExtension/ # Safari Web Extension (JS, CSS, fonts)
SpeedReader/Shared/               # Swift code shared between targets
```

For the full layout and where to put new files, see [STRUCTURE.md](STRUCTURE.md).

## Development Workflow

1. **Create a feature branch** — `feature/<short-description>` or `fix/<short-description>`
2. **Spec first** — all features need a specification before implementation
3. **Test first** — non-trivial logic gets a failing test before the implementation
4. **Small commits** — work in small iterative batches, commit as you go
5. **Verify** — run the full suite before opening a PR

For design decisions, conventions, and error philosophy, see [PRINCIPLES.md](PRINCIPLES.md).

## Testing and Linting

```bash
make test-all     # Run JS + Swift tests
make lint-all     # Run ESLint + SwiftLint
make ci           # Run everything (lint + test)
```

Individual commands:

| Command | What it runs |
|---------|-------------|
| `make test-js` | JavaScript tests (Node.js test runner) |
| `make test-swift` | Swift tests (also available via Cmd+U in Xcode) |
| `make lint-js` | ESLint |
| `make lint-swift` | SwiftLint |

Test on all three platforms before submitting: iPhone simulator, iPad simulator, and Mac (native).

## Pull Requests

- Branch from `main`, target `main`
- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- All CI checks must pass
- A full manual regression must be completed before merge

## Tech Stack

- **Swift / SwiftUI** — container app
- **JavaScript (ES2020+)** — Safari Web Extension
- **Readability.js** — text extraction (vendored, not an npm dependency)
- **Shadow DOM** — overlay isolation from page styles
- **WebExtension APIs** — `browser.storage`, content scripts, messaging

## Code Style

- **Swift**: follow [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/)
- **JavaScript**: ES2020+, no transpilation (Safari supports it natively)
- Both languages are enforced by their respective linters — run `make lint-all` to check

## Questions?

Open an issue if you have questions about contributing or run into problems with the development setup.
