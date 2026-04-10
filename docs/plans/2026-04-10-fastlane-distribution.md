# Fastlane Distribution & CI Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate App Store and TestFlight distribution with fastlane, triggered by git tags (TestFlight) and manual dispatch (App Store) via GitHub Actions.

**Architecture:** Fastlane handles build/sign/upload. CI workflows install signing certs into a temporary keychain, run fastlane lanes, then clean up. API key and certs are stored as GitHub secrets. Xcode's automatic signing downloads provisioning profiles at build time via the API key.

**Tech Stack:** Fastlane (Ruby/Bundler), GitHub Actions, Xcode CLI tools, App Store Connect API

**Spec:** `docs/superpowers/specs/2026-04-10-fastlane-distribution-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `Gemfile` | Create | Pin fastlane dependency |
| `fastlane/Appfile` | Create | App metadata (bundle ID, team ID) |
| `fastlane/Fastfile` | Create | Lane definitions (beta, release) |
| `fastlane/Gymfile` | Create | Shared build settings |
| `.gitignore` | Modify | Add fastlane artifacts |
| `.github/workflows/deploy-testflight.yml` | Create | Tag-triggered TestFlight deploy |
| `.github/workflows/deploy-appstore.yml` | Create | Manual App Store deploy |

---

### Task 1: Gemfile and fastlane initialization

**Files:**
- Create: `Gemfile`

- [ ] **Step 1: Create Gemfile**

```ruby
source "https://rubygems.org"

gem "fastlane", "~> 2.227"
```

- [ ] **Step 2: Install fastlane via bundler**

Run: `bundle install`
Expected: Fastlane installs successfully. A `Gemfile.lock` is generated.

- [ ] **Step 3: Verify fastlane is available**

Run: `bundle exec fastlane --version`
Expected: Prints fastlane version (2.227.x or similar)

- [ ] **Step 4: Add Gemfile.lock to gitignore**

Append to `.gitignore`:

```
Gemfile.lock
```

Note: Gemfile.lock for CLI tools (not libraries) is commonly gitignored in solo projects to avoid noisy diffs. If you later want reproducible CI builds, you can remove this and commit the lock file.

- [ ] **Step 5: Commit**

```bash
git add Gemfile .gitignore
git commit -m "Add Gemfile with fastlane dependency"
```

---

### Task 2: Fastlane configuration files

**Files:**
- Create: `fastlane/Appfile`
- Create: `fastlane/Gymfile`

- [ ] **Step 1: Create fastlane directory**

```bash
mkdir -p fastlane
```

- [ ] **Step 2: Create Appfile**

```ruby
app_identifier("com.chriscantu.SpeedReader")
team_id("4AKSB2RDBU")
```

- [ ] **Step 3: Create Gymfile**

```ruby
scheme("SpeedReader")
project("SpeedReader/SpeedReader.xcodeproj")
output_directory("./build")
export_method("app-store")
clean(true)
```

- [ ] **Step 4: Verify fastlane recognizes the config**

Run: `bundle exec fastlane env`
Expected: Output includes the app_identifier and team_id from Appfile. No errors about missing configuration.

- [ ] **Step 5: Commit**

```bash
git add fastlane/Appfile fastlane/Gymfile
git commit -m "Add fastlane Appfile and Gymfile configuration"
```

---

### Task 3: Fastfile with beta and release lanes

**Files:**
- Create: `fastlane/Fastfile`

- [ ] **Step 1: Create Fastfile with both lanes**

```ruby
default_platform(:ios)

platform :ios do
  before_all do
    app_store_connect_api_key(
      key_id: ENV.fetch("APP_STORE_CONNECT_KEY_ID"),
      issuer_id: ENV.fetch("APP_STORE_CONNECT_ISSUER_ID"),
      key_content: ENV.fetch("APP_STORE_CONNECT_KEY"),
      is_key_content_base64: true
    )
  end

  desc "Build and upload to TestFlight"
  lane :beta do
    build_app
    upload_to_testflight(
      skip_waiting_for_build_processing: true
    )
  end

  desc "Build and upload to App Store"
  lane :release do
    build_app
    upload_to_app_store(
      submit_for_review: false,
      automatic_release: false,
      skip_screenshots: true,
      skip_metadata: true
    )
  end
end
```

- [ ] **Step 2: Verify Fastfile parses correctly**

Run: `bundle exec fastlane lanes`
Expected: Lists two lanes — `ios beta` and `ios release` with their descriptions. No syntax errors.

- [ ] **Step 3: Commit**

```bash
git add fastlane/Fastfile
git commit -m "Add Fastfile with beta and release lanes"
```

---

### Task 4: Update .gitignore for fastlane artifacts

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append fastlane artifact patterns to .gitignore**

Add these lines to the end of `.gitignore`:

```
# Fastlane
fastlane/report.xml
fastlane/Preview.html
fastlane/screenshots
fastlane/test_output
```

Note: `build/` is already in `.gitignore`.

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "Add fastlane artifacts to .gitignore"
```

---

### Task 5: Deploy to TestFlight workflow (tag-triggered)

**Files:**
- Create: `.github/workflows/deploy-testflight.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Deploy to TestFlight

on:
  push:
    tags: ['v*']

concurrency:
  group: deploy-testflight-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    name: Build & Upload to TestFlight
    runs-on: macos-26
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true

      - name: Install signing certificate
        env:
          SIGNING_CERTIFICATE_P12: ${{ secrets.SIGNING_CERTIFICATE_P12 }}
          SIGNING_CERTIFICATE_PASSWORD: ${{ secrets.SIGNING_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          # Create variables
          CERTIFICATE_PATH=$RUNNER_TEMP/certificate.p12
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db

          # Decode certificate
          echo -n "$SIGNING_CERTIFICATE_P12" | base64 --decode -o $CERTIFICATE_PATH

          # Create temporary keychain
          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          # Import certificate
          security import $CERTIFICATE_PATH -P "$SIGNING_CERTIFICATE_PASSWORD" \
            -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security set-key-partition-list -S apple-tool:,apple: \
            -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          # Add to keychain search list
          security list-keychains -d user -s $KEYCHAIN_PATH login.keychain-db

      - name: Build and upload to TestFlight
        env:
          APP_STORE_CONNECT_KEY_ID: ${{ secrets.APP_STORE_CONNECT_KEY_ID }}
          APP_STORE_CONNECT_ISSUER_ID: ${{ secrets.APP_STORE_CONNECT_ISSUER_ID }}
          APP_STORE_CONNECT_KEY: ${{ secrets.APP_STORE_CONNECT_KEY }}
        run: bundle exec fastlane beta

      - name: Clean up keychain
        if: always()
        run: |
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          if [ -f "$KEYCHAIN_PATH" ]; then
            security delete-keychain $KEYCHAIN_PATH
          fi
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-testflight.yml'))"`
Expected: No output (valid YAML). If python3 is not available, use: `ruby -ryaml -e "YAML.safe_load(File.read('.github/workflows/deploy-testflight.yml'))"`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-testflight.yml
git commit -m "Add tag-triggered TestFlight deploy workflow"
```

---

### Task 6: Deploy to App Store workflow (manual dispatch)

**Files:**
- Create: `.github/workflows/deploy-appstore.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Deploy to App Store

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag to release (e.g., v1.0.1)'
        required: true
        type: string

concurrency:
  group: deploy-appstore
  cancel-in-progress: false

jobs:
  deploy:
    name: Build & Upload to App Store
    runs-on: macos-26
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.version }}

      - name: Verify tag exists
        run: |
          if ! git describe --tags --exact-match HEAD 2>/dev/null; then
            echo "Error: '${{ github.event.inputs.version }}' is not a valid tag"
            exit 1
          fi

      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true

      - name: Install signing certificate
        env:
          SIGNING_CERTIFICATE_P12: ${{ secrets.SIGNING_CERTIFICATE_P12 }}
          SIGNING_CERTIFICATE_PASSWORD: ${{ secrets.SIGNING_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          # Create variables
          CERTIFICATE_PATH=$RUNNER_TEMP/certificate.p12
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db

          # Decode certificate
          echo -n "$SIGNING_CERTIFICATE_P12" | base64 --decode -o $CERTIFICATE_PATH

          # Create temporary keychain
          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          # Import certificate
          security import $CERTIFICATE_PATH -P "$SIGNING_CERTIFICATE_PASSWORD" \
            -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security set-key-partition-list -S apple-tool:,apple: \
            -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          # Add to keychain search list
          security list-keychains -d user -s $KEYCHAIN_PATH login.keychain-db

      - name: Build and upload to App Store
        env:
          APP_STORE_CONNECT_KEY_ID: ${{ secrets.APP_STORE_CONNECT_KEY_ID }}
          APP_STORE_CONNECT_ISSUER_ID: ${{ secrets.APP_STORE_CONNECT_ISSUER_ID }}
          APP_STORE_CONNECT_KEY: ${{ secrets.APP_STORE_CONNECT_KEY }}
        run: bundle exec fastlane release

      - name: Clean up keychain
        if: always()
        run: |
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          if [ -f "$KEYCHAIN_PATH" ]; then
            security delete-keychain $KEYCHAIN_PATH
          fi
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-appstore.yml'))"`
Expected: No output (valid YAML).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-appstore.yml
git commit -m "Add manual App Store deploy workflow"
```

---

### Task 7: Setup guide for secrets

This task creates a reference document so the developer knows how to set up the required secrets. This is not code — it's documentation that makes the system usable.

**Files:**
- Create: `docs/setup-distribution.md`

- [ ] **Step 1: Create the setup guide**

```markdown
# Distribution Setup Guide

## Prerequisites

- Apple Developer Program membership
- App Store Connect admin access
- macOS with Keychain Access

## 1. Create App Store Connect API Key

1. Go to [App Store Connect > Users and Access > Integrations > App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. Click **Generate API Key**
3. Name: `SpeedReader CI`
4. Access: `App Manager`
5. Download the `.p8` file (you can only download it once)
6. Note the **Key ID** and **Issuer ID** shown on the page

## 2. Export Distribution Certificate

1. Open **Keychain Access** on your Mac
2. Find your **Apple Distribution** certificate (under "My Certificates")
3. Right-click → **Export**
4. Save as `.p12` format
5. Set a password when prompted (you'll need this for the secret)

If you don't have a distribution certificate:
1. Open Xcode → Settings → Accounts → your team → Manage Certificates
2. Click **+** → **Apple Distribution**
3. Then export from Keychain Access as above

## 3. Base64 Encode Files

```fish
# Encode the .p8 API key
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
# Paste as APP_STORE_CONNECT_KEY secret

# Encode the .p12 certificate
base64 -i Certificates.p12 | pbcopy
# Paste as SIGNING_CERTIFICATE_P12 secret
```

## 4. Add GitHub Secrets

Go to [repo Settings > Secrets and variables > Actions](https://github.com/chriscantu/speed-reader/settings/secrets/actions) and add:

| Secret | Value |
|--------|-------|
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from step 1 |
| `APP_STORE_CONNECT_KEY_ID` | Key ID from step 1 |
| `APP_STORE_CONNECT_KEY` | Base64-encoded .p8 content |
| `SIGNING_CERTIFICATE_P12` | Base64-encoded .p12 content |
| `SIGNING_CERTIFICATE_PASSWORD` | Password from step 2 |
| `KEYCHAIN_PASSWORD` | Any strong random password (e.g., `openssl rand -base64 32`) |

## 5. Test the Setup

```fish
# Bump version and push tag to trigger TestFlight deploy
bun run version:bump -- patch
git push && git push --tags

# Watch the workflow run
gh run watch
```

## Troubleshooting

**"No signing certificate found"** — The P12 was not imported correctly. Re-export from Keychain Access, making sure to select "Apple Distribution" (not "Apple Development").

**"No provisioning profile"** — Xcode automatic signing needs the API key to download profiles. Verify `APP_STORE_CONNECT_KEY_ID` and `APP_STORE_CONNECT_ISSUER_ID` are correct.

**"API key not found"** — Check that `APP_STORE_CONNECT_KEY` is the base64-encoded content of the .p8 file, not the file path.
```

- [ ] **Step 2: Commit**

```bash
git add docs/setup-distribution.md
git commit -m "Add distribution setup guide for secrets and certificates"
```

---

### Task 8: Update STRUCTURE.md

**Files:**
- Modify: `STRUCTURE.md`

- [ ] **Step 1: Add fastlane directory to the directory layout**

In the directory layout section of `STRUCTURE.md`, add after the `scripts/` entry:

```
├── fastlane/                          # Fastlane distribution config
│   ├── Appfile                        # App metadata (bundle ID, team)
│   ├── Fastfile                       # Lane definitions (beta, release)
│   └── Gymfile                        # Shared build settings
```

- [ ] **Step 2: Add fastlane to the "Where Things Go" table**

Add this row to the table:

```
| Fastlane config | `fastlane/` |
```

- [ ] **Step 3: Commit**

```bash
git add STRUCTURE.md
git commit -m "Add fastlane directory to STRUCTURE.md"
```
