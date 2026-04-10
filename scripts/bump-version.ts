#!/usr/bin/env bun

import { argv, exit } from "process";

const PBXPROJ_PATH = "SpeedReader/SpeedReader.xcodeproj/project.pbxproj";

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

// Only execute CLI logic when this file is the entry point, not when imported
if (import.meta.main) {
  // Script args start at index 2 (bun run scripts/bump-version.ts <args>)
  const { bumpType, dryRun } = parseArgs(argv.slice(2));

  if (dryRun) {
    console.log("[dry-run] No files will be modified.\n");
  }

  console.log(`Bump type: ${bumpType}`);
}
