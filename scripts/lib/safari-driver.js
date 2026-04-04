// scripts/lib/safari-driver.js
// Safari automation bridge — wraps osascript for Node.js regression tests.
// NOTE: Uses execSync intentionally — osascript is a local-only test tool,
// not production code. No user input reaches these commands.

import { execSync } from 'node:child_process';

const TEST_URL = 'https://en.wikipedia.org/wiki/Speed_reading';

/**
 * Run arbitrary JavaScript in Safari's active document via osascript.
 * Returns the string result. Throws on osascript failure.
 */
export function execJS(jsCode) {
  const escaped = jsCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const cmd = `osascript -e 'tell application "Safari" to do JavaScript "${escaped}" in document 1'`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    return result.trim();
  } catch (e) {
    const msg = e.stderr ? e.stderr.trim() : e.message;
    throw new Error(`execJS failed: ${msg}`);
  }
}

/**
 * Navigate Safari to a URL and wait for the page to load.
 */
export async function navigate(url = TEST_URL) {
  execSync(
    `osascript -e 'tell application "Safari" to set URL of document 1 to "${url}"'`,
    { encoding: 'utf-8', timeout: 10000 }
  );
  execSync(
    `osascript -e 'tell application "Safari" to activate'`,
    { encoding: 'utf-8', timeout: 5000 }
  );
  await waitFor(() => {
    const state = execJS('document.readyState');
    return state === 'complete';
  }, { timeout: 15000, interval: 500 });
}

/**
 * Poll a predicate function until it returns true.
 * Predicate can be sync (returns bool) or async (returns Promise<bool>).
 */
export async function waitFor(predicate, { timeout = 5000, interval = 200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await predicate();
      if (result) return;
    } catch {
      // predicate threw — keep polling
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Query overlay state via the content script's speedreader-test-query handler.
 * Returns a parsed object with overlay state fields.
 */
export async function queryState() {
  execJS(
    "window.__srTestResult = null;" +
    "window.addEventListener('message', function handler(e) {" +
    "  if (e.data && e.data.type === 'speedreader-test-result') {" +
    "    window.__srTestResult = JSON.stringify(e.data.data);" +
    "    window.removeEventListener('message', handler);" +
    "  }" +
    "});" +
    "window.postMessage({type: 'speedreader-test-query'}, '*');"
  );

  let json = null;
  await waitFor(() => {
    const raw = execJS('window.__srTestResult || "null"');
    if (raw && raw !== 'null') {
      json = raw;
      return true;
    }
    return false;
  }, { timeout: 3000, interval: 100 });

  try {
    return JSON.parse(json);
  } catch {
    throw new Error(`queryState: failed to parse JSON: ${json}`);
  }
}

/**
 * Send a generic dispatch command to the content script.
 * Uses the speedreader-test-dispatch postMessage type.
 */
export function dispatch(action, payload = {}) {
  const msg = JSON.stringify({ type: 'speedreader-test-dispatch', action, payload });
  execJS("window.postMessage(" + msg.replace(/"/g, '\\"') + ", '*')");
}

/**
 * Toggle the overlay open/closed via speedreader-test-toggle.
 */
export function toggle() {
  execJS("window.postMessage({type: 'speedreader-test-toggle'}, '*')");
}

/**
 * Click an element inside the overlay's shadow DOM by CSS selector.
 */
export function clickOverlay(selector) {
  const escaped = selector.replace(/'/g, "\\'");
  execJS("window.postMessage({type: 'speedreader-test-click', selector: '" + escaped + "'}, '*')");
}

export { TEST_URL };
