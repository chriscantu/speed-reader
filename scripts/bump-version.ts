#!/usr/bin/env bun

import { argv, exit } from "process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PBXPROJ_PATH = "SpeedReader/SpeedReader.xcodeproj/project.pbxproj";
const EXPECTED_MARKETING_COUNT = 4;
const EXPECTED_BUILD_COUNT = 8;

type BumpType = "major" | "minor" | "patch";

function printUsage(): void {
  console.log("Usage: bun run scripts/bump-version.ts <major|minor|patch> [--dry-run]");
  console.log("");
  console.log("Examples:");
  console.log("  bun run scripts/bump-version.ts patch");
  console.log("  bun run scripts/bump-version.ts minor --dry-run");
}

function parseArgs(args: string[]): { bumpType: BumpType; dryRun: boolean } {
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = args.filter((a) => a.startsWith("--"));

  const bumpType = positional[0] as BumpType;
  if (!["major", "minor", "patch"].includes(bumpType)) {
    printUsage();
    exit(1);
  }

  const dryRun = flags.includes("--dry-run");
  return { bumpType, dryRun };
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(versionStr: string): SemVer {
  const parts = versionStr.split(".").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version: "${versionStr}"`);
  }
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2] ?? 0,
  };
}

export function bumpVersion(current: SemVer, type: BumpType): string {
  switch (type) {
    case "major":
      return `${current.major + 1}.0.0`;
    case "minor":
      return `${current.major}.${current.minor + 1}.0`;
    case "patch":
      return `${current.major}.${current.minor}.${current.patch + 1}`;
  }
}

interface ExtractedVersions {
  marketingVersion: string;
  buildNumber: number;
}

interface ReplaceResult {
  content: string;
  marketingCount: number;
  buildCount: number;
}

export function extractVersions(content: string): ExtractedVersions {
  const marketingMatch = content.match(/MARKETING_VERSION = ([^;]+);/);
  if (!marketingMatch) {
    throw new Error("Could not find MARKETING_VERSION in project.pbxproj");
  }

  const buildMatch = content.match(/CURRENT_PROJECT_VERSION = (\d+);/);
  if (!buildMatch) {
    throw new Error("Could not find CURRENT_PROJECT_VERSION in project.pbxproj");
  }

  return {
    marketingVersion: marketingMatch[1].trim(),
    buildNumber: parseInt(buildMatch[1], 10),
  };
}

export function replaceVersions(content: string, newMarketing: string, newBuild: number): ReplaceResult {
  let marketingCount = 0;
  let buildCount = 0;

  const updated = content
    .replace(/MARKETING_VERSION = [^;]+;/g, () => {
      marketingCount++;
      return `MARKETING_VERSION = ${newMarketing};`;
    })
    .replace(/CURRENT_PROJECT_VERSION = \d+;/g, () => {
      buildCount++;
      return `CURRENT_PROJECT_VERSION = ${newBuild};`;
    });

  return { content: updated, marketingCount, buildCount };
}

function validateWithPlutil(content: string): void {
  const tempDir = mkdtempSync(join(tmpdir(), "bump-version-"));
  const tempFile = join(tempDir, "project.pbxproj");
  writeFileSync(tempFile, content);

  try {
    execSync(`plutil -lint "${tempFile}"`, { stdio: "pipe" });
  } catch {
    throw new Error(
      "plutil validation failed — the modified project.pbxproj is not valid. Original file was NOT modified."
    );
  }
}

function bumpPbxproj(bumpType: BumpType, dryRun: boolean): { newVersion: string; newBuild: number } {
  const content = readFileSync(PBXPROJ_PATH, "utf-8");

  const { marketingVersion, buildNumber } = extractVersions(content);
  const current = parseVersion(marketingVersion);
  const newVersion = bumpVersion(current, bumpType);
  const newBuild = buildNumber + 1;

  console.log(`Marketing version: ${marketingVersion} → ${newVersion}`);
  console.log(`Build number: ${buildNumber} → ${newBuild}`);

  const { content: updated, marketingCount, buildCount } = replaceVersions(content, newVersion, newBuild);

  if (marketingCount !== EXPECTED_MARKETING_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_MARKETING_COUNT} MARKETING_VERSION replacements, got ${marketingCount}. Aborting.`
    );
  }
  if (buildCount !== EXPECTED_BUILD_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_BUILD_COUNT} CURRENT_PROJECT_VERSION replacements, got ${buildCount}. Aborting.`
    );
  }

  console.log(`Replaced ${marketingCount} MARKETING_VERSION and ${buildCount} CURRENT_PROJECT_VERSION entries.`);

  if (dryRun) {
    console.log("\n[dry-run] No files modified.");
    return { newVersion, newBuild };
  }

  validateWithPlutil(updated);
  writeFileSync(PBXPROJ_PATH, updated);
  console.log(`\nWrote ${PBXPROJ_PATH}`);

  return { newVersion, newBuild };
}

// --- Main ---
if (import.meta.main) {
  const { bumpType, dryRun } = parseArgs(argv.slice(2));

  if (dryRun) {
    console.log("[dry-run] No files will be modified.\n");
  }

  const { newVersion, newBuild } = bumpPbxproj(bumpType, dryRun);
}
