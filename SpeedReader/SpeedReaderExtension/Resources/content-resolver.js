/**
 * Pure decision logic for content script text extraction.
 * Determines which content source to use and what action to take.
 *
 * Extracted from extractAndLaunch() for testability — content.js handles
 * the async/side-effect parts, this module handles the branching.
 * Intentionally pure (no DOM access, no I/O) to enable fast unit testing
 * without browser mocks.
 *
 * @module content-resolver
 */

/**
 * @typedef {Object} ContentInputs
 * @property {string|null} selectedText  - Trimmed selection text, or null
 * @property {boolean} selectionError    - Whether the selection API threw
 * @property {boolean} pendingSelectionMode - Whether we're waiting for user to select text
 * @property {{ textContent: string, title: string }|null} article - Readability result
 * @property {boolean} articleError      - Whether the Readability import or parse threw an exception
 */

/**
 * @typedef {Object} ContentDecision
 * @property {'use-selection'|'use-article'|'prompt-selection'|'enter-selection-mode'} action
 * @property {string} [text]            - Content text (present only for use-selection and use-article)
 * @property {string} [title]           - Article title (for use-article; may be empty — caller provides fallback)
 * @property {boolean} [selectionWarning] - True if selection API failed; omitted when action is use-selection
 */

/**
 * Resolves which content source to use based on available inputs.
 *
 * Decision priority:
 * 1. User text selection (highest priority)
 * 2. If in pending selection mode and no selection → prompt user
 * 3. Readability article extraction (fallback)
 * 4. Enter selection mode (last resort)
 *
 * @param {ContentInputs} inputs
 * @returns {ContentDecision}
 */
export function resolveContent(inputs) {
  if (!inputs || typeof inputs !== 'object') {
    return { action: 'enter-selection-mode', selectionWarning: false };
  }

  const {
    selectedText,
    selectionError,
    pendingSelectionMode,
    article,
    articleError,
  } = inputs;

  // Selection takes priority when available
  if (selectedText) {
    return { action: 'use-selection', text: selectedText };
  }

  // If selection API failed, note the warning but continue to Readability
  const selectionWarning = !!selectionError;

  // If waiting for user to select text and they haven't, remind them
  if (pendingSelectionMode) {
    return { action: 'prompt-selection', selectionWarning };
  }

  // Try Readability result
  if (!articleError && article && article.textContent && article.textContent.trim().length > 0) {
    return {
      action: 'use-article',
      text: article.textContent.trim(),
      title: article.title || '',
      selectionWarning,
    };
  }

  // Nothing worked — ask user to manually select text
  return { action: 'enter-selection-mode', selectionWarning };
}
