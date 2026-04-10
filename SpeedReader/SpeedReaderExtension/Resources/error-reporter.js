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
