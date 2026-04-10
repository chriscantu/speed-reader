# Fastlane Distribution & CI Deploy

**Issues**: #46, #48
**Date**: 2026-04-10
**Status**: Approved

## Problem Statement

**User**: Solo developer shipping SpeedReader to the App Store
**Problem**: Releasing requires manually archiving in Xcode, uploading via Organizer/Transporter, and navigating App Store Connect — a multi-step process that's error-prone and discourages frequent shipping.
**Impact**: Each release is a manual chore. Mistakes waste time and delay releases. No CI integration means releases can only happen from a Mac with Xcode open.
**Constraints**: Apple ecosystem; automatic code signing (team 4AKSB2RDBU); two targets (app + Safari extension); GitHub Actions with macOS runner; fish shell; Bun runtime.

## Approach

- **Fastlane** for build/sign/upload automation
- **Manual cert installation** on CI (no `match` — solo developer, not worth the overhead)
- **Tag-triggered** TestFlight deploys, **manual dispatch** for App Store releases
- **App Store Connect API key** via environment variables (not file-based)

## Fastlane Configuration

### Files

| File | Purpose |
|------|---------|
| `Gemfile` | Pin fastlane version |
| `fastlane/Appfile` | App metadata (team ID, bundle ID) |
| `fastlane/Fastfile` | Lane definitions (beta, release) |
| `fastlane/Gymfile` | Shared build settings (scheme, project, export method) |

### Appfile

```ruby
app_identifier("com.chriscantu.SpeedReader")
team_id("4AKSB2RDBU")
```

### Lanes

**`beta`** — Build, sign, upload to TestFlight:
1. Configure App Store Connect API key from environment variables
2. `build_app` using Gymfile settings with `export_method: "app-store"`
3. `upload_to_testflight` with `skip_waiting_for_build_processing: true`

**`release`** — Build, sign, upload to App Store:
1. Configure App Store Connect API key from environment variables
2. `build_app` using Gymfile settings with `export_method: "app-store"`
3. `upload_to_app_store` with `submit_for_review: false` (manual submit in ASC)

### Gymfile

```ruby
scheme("SpeedReader")
project("SpeedReader/SpeedReader.xcodeproj")
output_directory("./build")
export_method("app-store")
clean(true)
```

### App Store Connect API Key

Read from environment variables (works both locally and in CI):
- `APP_STORE_CONNECT_ISSUER_ID` — From App Store Connect > Keys
- `APP_STORE_CONNECT_KEY_ID` — From App Store Connect > Keys
- `APP_STORE_CONNECT_KEY` — Base64-encoded .p8 file content

Configured in Fastfile via `app_store_connect_api_key` action.

## Code Signing on CI

### Strategy

Export existing distribution certificate as .p12, store as base64-encoded GitHub secret, install into a temporary CI keychain at build time. Provisioning profiles are downloaded automatically by Xcode via the API key (automatic signing).

### Secrets (6 total)

| Secret | What it is |
|--------|------------|
| `APP_STORE_CONNECT_ISSUER_ID` | From App Store Connect > Keys |
| `APP_STORE_CONNECT_KEY_ID` | From App Store Connect > Keys |
| `APP_STORE_CONNECT_KEY` | Base64-encoded .p8 file content |
| `SIGNING_CERTIFICATE_P12` | Base64-encoded .p12 export of distribution cert |
| `SIGNING_CERTIFICATE_PASSWORD` | Password used when exporting the .p12 |
| `KEYCHAIN_PASSWORD` | Arbitrary password for the temporary CI keychain |

### CI Signing Flow

1. Create a temporary keychain with `KEYCHAIN_PASSWORD`
2. Decode `SIGNING_CERTIFICATE_P12` from base64, import into the temporary keychain
3. Set the keychain as default and unlock it
4. Xcode downloads provisioning profiles automatically via API key (handles both app and extension targets)
5. After the job completes (success or failure), delete the temporary keychain

No provisioning profile secrets needed — Xcode's automatic signing downloads them when given an API key.

## GitHub Actions Workflows

### `deploy-testflight.yml` — Tag-triggered

```yaml
on:
  push:
    tags: ['v*']
```

- Runs on `macos-26`
- Sets up Ruby + Bundler (for fastlane)
- Installs signing cert into temporary keychain
- Runs `fastlane beta`
- Cleans up keychain (always, even on failure)

### `deploy-appstore.yml` — Manual dispatch

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag to release (e.g., v1.0.1)'
        required: true
```

- Same runner and signing setup
- Checks out the specified tag
- Runs `fastlane release`
- Cleans up keychain

### Existing `ci.yml` — Untouched

Continues to run tests and lint on PRs/pushes to main. Deploy workflows are separate.

## Release Workflow

```fish
bun run version:bump -- patch          # bumps version, commits, tags v1.0.1
git push && git push --tags            # triggers deploy-testflight.yml
# Later, for App Store:
# GitHub Actions > Deploy to App Store > Run workflow > enter "v1.0.1"
```

## Error Handling

- Workflows fail fast — no retry logic
- Temporary keychain cleaned up in `always()` step (no secrets leak on failure)
- Fastlane provides clear error output for signing mismatches, API auth failures, etc.

## .gitignore Additions

```
# Fastlane
fastlane/report.xml
fastlane/Preview.html
fastlane/screenshots
fastlane/test_output
build/
```

## Out of Scope

- No automatic App Store submission on tag push (deliberate)
- No `match` or cert repo
- No Slack/Discord notifications
- No changelog upload to App Store Connect
- No version bumping in CI (that's bump-version's job)
- No screenshot automation
