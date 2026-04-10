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

// Script args start at index 2 (bun run scripts/bump-version.ts <args>)
const { bumpType, dryRun } = parseArgs(argv.slice(2));

if (dryRun) {
  console.log("[dry-run] No files will be modified.\n");
}

console.log(`Bump type: ${bumpType}`);
