import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { parseVersion, bumpVersion, extractVersions, replaceVersions } from "../../scripts/bump-version.ts";

describe("parseVersion", () => {
  it("parses three-segment version", () => {
    const result = parseVersion("1.2.3");
    assert.deepStrictEqual(result, { major: 1, minor: 2, patch: 3 });
  });

  it("normalizes two-segment version to three", () => {
    const result = parseVersion("1.0");
    assert.deepStrictEqual(result, { major: 1, minor: 0, patch: 0 });
  });

  it("throws on invalid version", () => {
    assert.throws(() => parseVersion("abc"), /Invalid version/);
  });
});

describe("bumpVersion", () => {
  it("bumps patch", () => {
    assert.equal(bumpVersion({ major: 1, minor: 0, patch: 0 }, "patch"), "1.0.1");
  });

  it("bumps minor and resets patch", () => {
    assert.equal(bumpVersion({ major: 1, minor: 2, patch: 3 }, "minor"), "1.3.0");
  });

  it("bumps major and resets minor and patch", () => {
    assert.equal(bumpVersion({ major: 1, minor: 2, patch: 3 }, "major"), "2.0.0");
  });
});

const SAMPLE_PBXPROJ = `
				CURRENT_PROJECT_VERSION = 1;
				MARKETING_VERSION = 1.0;
			};
			name = Debug;
		};
		ABC123 = {
				CURRENT_PROJECT_VERSION = 1;
				MARKETING_VERSION = 1.0;
`;

describe("extractVersions", () => {
  it("extracts marketing version and build number", () => {
    const result = extractVersions(SAMPLE_PBXPROJ);
    assert.equal(result.marketingVersion, "1.0");
    assert.equal(result.buildNumber, 1);
  });

  it("throws if marketing version not found", () => {
    assert.throws(() => extractVersions("no versions here"), /Could not find MARKETING_VERSION/);
  });

  it("throws if build number not found", () => {
    const noBuilt = "MARKETING_VERSION = 1.0;";
    assert.throws(() => extractVersions(noBuilt), /Could not find CURRENT_PROJECT_VERSION/);
  });
});

describe("replaceVersions", () => {
  it("replaces all version occurrences", () => {
    const result = replaceVersions(SAMPLE_PBXPROJ, "1.0.1", 2);
    assert.equal((result.content.match(/MARKETING_VERSION = 1\.0\.1;/g) || []).length, 2);
    assert.equal((result.content.match(/CURRENT_PROJECT_VERSION = 2;/g) || []).length, 2);
    assert.equal(result.marketingCount, 2);
    assert.equal(result.buildCount, 2);
  });

  it("does not modify unrelated content", () => {
    const result = replaceVersions(SAMPLE_PBXPROJ, "1.0.1", 2);
    assert.ok(result.content.includes("name = Debug;"));
  });
});

describe("bump-version CLI (integration)", () => {
  it("dry-run prints version bump without modifying files", () => {
    const output = execSync("bun run scripts/bump-version.ts patch --dry-run", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    assert.ok(output.includes("Marketing version:"));
    assert.ok(output.includes("\u2192"));
    assert.ok(output.includes("[dry-run]"));
    assert.ok(output.includes("Changelog:"));
  });

  it("rejects invalid bump type", () => {
    assert.throws(
      () => execSync("bun run scripts/bump-version.ts invalid", { encoding: "utf-8", stdio: "pipe" }),
    );
  });

  it("rejects missing bump type", () => {
    assert.throws(
      () => execSync("bun run scripts/bump-version.ts", { encoding: "utf-8", stdio: "pipe" }),
    );
  });
});
