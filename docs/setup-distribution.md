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
3. Right-click > **Export**
4. Save as `.p12` format
5. Set a password when prompted (you'll need this for the secret)

If you don't have a distribution certificate:
1. Open Xcode > Settings > Accounts > your team > Manage Certificates
2. Click **+** > **Apple Distribution**
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
