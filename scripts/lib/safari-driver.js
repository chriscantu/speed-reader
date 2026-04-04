// scripts/lib/safari-driver.js
// Safari automation bridge — wraps osascript for Node.js regression tests.
// Uses execFileSync to avoid shell interpolation — osascript arguments are
// passed directly, not through a shell. This is a local-only test tool;
// no user input reaches these commands.

import { execFileSync } from 'node:child_process';

const TEST_URL = 'https://en.wikipedia.org/wiki/Speed_reading';

/**
 * Run arbitrary JavaScript in Safari's active document via osascript.
 * Returns the string result. Throws on osascript failure.
 */
export function execJS(jsCode) {
  // Escape backslashes and double quotes for the AppleScript string literal.
  // execFileSync passes the argument directly to osascript (no shell).
  const appleScript = `tell application "Safari" to do JavaScript "${jsCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" in document 1`;
  try {
    const result = execFileSync('osascript', ['-e', appleScript], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trim();
  } catch (e) {
    const msg = e.stderr ? e.stderr.trim() : e.message;
    throw new Error(`execJS failed: ${msg}`);
  }
}

/**
 * Navigate Safari to a URL and wait for the new page to load.
 * Marks the old page, waits for the marker to disappear (new page loaded),
 * then waits for document.readyState === 'complete'.
 */
export async function navigate(url = TEST_URL) {
  // Mark current page so we can detect when navigation actually starts
  execJS('document.__srNavPending = true');
  const safeUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  execFileSync('osascript', ['-e', `tell application "Safari" to set URL of document 1 to "${safeUrl}"`], {
    encoding: 'utf-8', timeout: 10000,
  });
  execFileSync('osascript', ['-e', 'tell application "Safari" to activate'], {
    encoding: 'utf-8', timeout: 5000,
  });
  // Wait for the NEW page to finish loading (marker absent = new page)
  await waitFor(() => {
    try {
      const marker = execJS('document.__srNavPending');
      // If marker still exists, we're on the old page
      if (marker === 'true') return false;
    } catch (err) {
      // Page transition errors are expected (Safari returns error while loading).
      // Log unexpected errors so they're visible in test output.
      const msg = err.message || '';
      if (!msg.includes("Can't get document") && !msg.includes('missing value')) {
        console.warn(`[safari-driver] navigate poll error: ${msg}`);
      }
    }
    const state = execJS('document.readyState');
    return state === 'complete';
  }, { timeout: 15000, interval: 500 });
}

/**
 * Poll a predicate function until it returns true.
 * Predicate can be sync (returns bool) or async (returns Promise<bool>).
 * On timeout, includes the last error message for diagnostics.
 */
export async function waitFor(predicate, { timeout = 5000, interval = 200 } = {}) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeout) {
    try {
      const result = await predicate();
      if (result) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise(r => setTimeout(r, interval));
  }
  const detail = lastError ? `\nLast error: ${lastError.message}` : '';
  throw new Error(`waitFor timed out after ${timeout}ms${detail}`);
}

/**
 * Query overlay state via the content script's speedreader-test-query handler.
 * Registers a one-shot message listener in the page context, triggers the
 * query via postMessage, then polls until the response arrives.
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
 * Fire-and-forget — callers must verify effects via queryState/waitFor.
 */
export function dispatch(action, payload = {}) {
  const msg = JSON.stringify({ type: 'speedreader-test-dispatch', action, payload });
  // Use JSON.parse inside the JS string to keep data separate from code,
  // avoiding double-escaping issues with quotes/backslashes in payloads.
  const escaped = msg.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  execJS("window.postMessage(JSON.parse('" + escaped + "'), '*')");
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
