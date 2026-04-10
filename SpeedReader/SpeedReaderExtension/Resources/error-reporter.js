/**
 * Lightweight error capture for the SpeedReader extension.
 * Intercepts uncaught errors and unhandled promise rejections,
 * persists them to browser.storage.local (FIFO, capped),
 * and bridges them to native os_log via sendNativeMessage().
 *
 * @module error-reporter
 */

export const ERROR_LOG_CAP = 50;
const MAX_MESSAGE_LENGTH = 500;

/**
 * Extract hostname from a URL string. Returns empty string on failure.
 * Strips path, query params, port — PII-safe.
 *
 * @param {string|null|undefined} url - A full URL string
 * @returns {string} The hostname, or empty string if extraction fails
 */
export function extractHostname(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Format an error into a storage-safe payload.
 *
 * @param {Error|string} error - The caught error or error message string
 * @param {string} source - Which script: 'content', 'background', 'overlay'
 * @param {string} pageUrl - The full page URL (will be stripped to hostname)
 * @returns {{timestamp: string, message: string, stack: string, source: string, url: string, userAgent: string}}
 */
export function formatErrorPayload(error, source, pageUrl) {
  let message = '';
  let stack = '';

  if (error instanceof Error) {
    message = error.message || '';
    stack = error.stack || '';
  } else {
    message = String(error);
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    message = message.slice(0, MAX_MESSAGE_LENGTH);
  }

  return {
    timestamp: new Date().toISOString(),
    message,
    stack,
    source,
    url: extractHostname(pageUrl),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

/**
 * Persist an error payload to browser.storage.local under 'errorLog'.
 * FIFO: drops oldest entries when the log exceeds ERROR_LOG_CAP.
 *
 * @param {object} payload - Formatted error payload from formatErrorPayload()
 * @param {object} [storage] - Storage backend (defaults to browser.storage.local). Accepts any object with get()/set() returning promises — used for testing.
 */
export async function storeError(payload, storage) {
  const store = storage || browser.storage.local;
  const { errorLog } = await store.get({ errorLog: [] });
  errorLog.push(payload);
  if (errorLog.length > ERROR_LOG_CAP) {
    errorLog.splice(0, errorLog.length - ERROR_LOG_CAP);
  }
  await store.set({ errorLog });
}

/**
 * Fire-and-forget: send error payload to native SafariWebExtensionHandler
 * via sendNativeMessage. Swallows errors — if native side is unavailable,
 * the error remains in browser.storage.local as fallback.
 */
function sendToNative(payload) {
  if (typeof browser === 'undefined' || !browser.runtime || !browser.runtime.sendNativeMessage) {
    return;
  }
  browser.runtime.sendNativeMessage(
    'com.chriscantu.SpeedReader',
    { action: 'jsError', error: payload }
  ).catch(() => {
    // Fire-and-forget — native handler unavailable is not fatal
  });
}

/**
 * Public API for explicit error reporting from try-catch blocks.
 * Formats the error, stores it, and bridges it to native logging.
 *
 * @param {Error|string} error - The caught error
 * @param {string} source - Which script: 'content', 'background', 'overlay'
 * @param {string} [pageUrl=''] - Current page URL (stripped to hostname)
 * @param {object} [options={}] - Options. Pass { storage } for testing.
 * @returns {Promise<object|null>} The stored payload, or null if storage failed
 */
export async function reportError(error, source, pageUrl, options) {
  const opts = options || {};
  const payload = formatErrorPayload(error, source, pageUrl || '');
  try {
    await storeError(payload, opts.storage);
    sendToNative(payload);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Install global error and unhandledrejection handlers on a window-like target.
 * Used by content.js and overlay.js (runs in page context with `window`).
 *
 * @param {string} source - Script identifier: 'content' or 'overlay'
 * @param {string} pageUrl - Current page URL (will be stripped to hostname)
 * @param {object} [options={}] - Options. Pass { target, storage } for testing.
 */
export function installWindowHandlers(source, pageUrl, options) {
  const opts = options || {};
  const target = opts.target || window;

  target.addEventListener('error', (event) => {
    const error = event.error || event.message || 'Unknown error';
    reportError(error, source, pageUrl, { storage: opts.storage });
  });

  target.addEventListener('unhandledrejection', (event) => {
    const error = event.reason || 'Unhandled promise rejection';
    reportError(error, source, pageUrl, { storage: opts.storage });
  });
}

/**
 * Install global error and unhandledrejection handlers on a service worker target.
 * Used by background.js (runs in service worker context — no `window`).
 *
 * @param {object} [options={}] - Options. Pass { target, storage } for testing.
 */
export function installServiceWorkerHandlers(options) {
  const opts = options || {};
  const target = opts.target || self;

  target.addEventListener('error', (event) => {
    const error = event.error || event.message || 'Unknown error';
    reportError(error, 'background', '', { storage: opts.storage });
  });

  target.addEventListener('unhandledrejection', (event) => {
    const error = event.reason || 'Unhandled promise rejection';
    reportError(error, 'background', '', { storage: opts.storage });
  });
}
