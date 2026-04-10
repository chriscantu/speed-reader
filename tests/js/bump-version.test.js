import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseVersion, bumpVersion } from "../../scripts/bump-version.ts";

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
