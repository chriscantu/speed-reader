# Version Bump Script & Git Tagging Strategy

**Issue**: #47
**Date**: 2026-04-09
**Status**: Approved

## Problem Statement

**User**: Solo developer managing SpeedReader releases across 3+ Xcode targets
**Problem**: Version numbers (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`) are hardcoded across 12 locations in `project.pbxproj`. Manual edits are error-prone and easy to forget across multiple targets.
**Impact**: Missed or inconsistent version bumps lead to App Store submission failures, mismatched target versions, and no reliable git history of what code shipped in which release.
**Evidence**: 12 version entries across the pbxproj (4 marketing + 8 build), all at `1.0`/`1`. Issues #46 (fastlane) and #48 (TestFlight) both depend on reliable versioning.
**Constraints**: Must work with Xcode's pbxproj format; fish shell; bun as JS runtime; project is at 1.0 (released to App Store).

## Approach

Direct pbxproj regex replacement in a Bun/TypeScript script, with `plutil -lint` validation as a safety net. Chosen over `agvtool` (unpredictable, no dry-run) and PlistBuddy (doesn't apply — versions live in pbxproj, not Info.plist).

## CLI Interface

Single script at `scripts/bump-version.ts`, invoked via bun:

```
bun run version:bump <major|minor|patch> [--dry-run]
```

- `patch` — `1.0.0` → `1.0.1`, build `1` → `2`
- `minor` — `1.0.0` → `1.1.0`, build increments
- `major` — `1.0.0` → `2.0.0`, build increments
- `--dry-run` — prints what would change without writing, committing, or tagging

### Build Number Strategy

`CURRENT_PROJECT_VERSION` is a monotonically incrementing integer. Each bump increments by 1 regardless of major/minor/patch. Apple requires this to always increase.

## Core Logic: Read → Transform → Validate → Write

1. **Read** `project.pbxproj` as UTF-8 text
2. **Parse current version** — extract first `MARKETING_VERSION = X.Y.Z;` and `CURRENT_PROJECT_VERSION = N;` to confirm current state
3. **Compute new versions** — apply semver bump, increment build number by 1
4. **Transform** — replace all occurrences of both keys with new values (global regex replace)
5. **Validate** — write to a temp file, run `plutil -lint`. If it fails, abort with error, original untouched
6. **Write** — overwrite original only after validation passes
7. **Report** — print old → new for both version fields, number of replacements made

### Safety Checks

- Normalize two-segment versions on read: `1.0` is treated as `1.0.0`
- Abort if current marketing version isn't valid semver (after normalization)
- Abort if replacement count doesn't match expected (4 marketing + 8 build = 12). Catches partial edits.
- `--dry-run` stops after step 4 and prints the diff

## Git Tagging & Changelog

After successful pbxproj write:

1. **Stage** the modified `project.pbxproj`
2. **Generate changelog** — `git log --oneline <last-tag>..HEAD` (if no previous tag, use recent history with limit of 50)
3. **Print changelog** to stdout for review
4. **Write changelog** to `CHANGELOG.md` — new version section appended at top, below heading
5. **Stage** `CHANGELOG.md`
6. **Commit** with message: `Bump version to X.Y.Z (build N)`
7. **Tag** with annotated tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`
8. **Do NOT push** — left to user (or future fastlane integration)

### Changelog Format

```markdown
## vX.Y.Z (YYYY-MM-DD)

- Commit message one
- Commit message two
```

### Dry-Run Behavior

Prints changelog and tag that would be created. Does not write, commit, or tag.

## Files

| File | Action |
|------|--------|
| `scripts/bump-version.ts` | New — main script |
| `package.json` | Add `version:bump` script alias |
| `CHANGELOG.md` | Created/updated on each bump |

No external dependencies — uses only `node:fs`, `node:child_process`, and bun built-in APIs.

## Release Workflow

```fish
bun run version:bump patch --dry-run  # preview
bun run version:bump patch            # bumps, commits, tags
git push && git push --tags           # manual push
```

## Out of Scope

- Pre-release versions (e.g., `1.0.1-beta.1`)
- Automatic push to remote
- CI integration (that's #46/#48)
