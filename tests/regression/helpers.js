// tests/regression/helpers.js
// Shared setup and utilities for regression tests.

import {
  execJS, navigate, queryState, waitFor,
  toggle, dispatch, clickOverlay, TEST_URL
} from '../../scripts/lib/safari-driver.js';

/**
 * Navigate to the test page and wait for the content script to load.
 */
export async function setupTestPage() {
  await navigate(TEST_URL);
  await waitFor(() => {
    const attr = execJS("document.documentElement.getAttribute('data-speedreader-loaded')");
    return attr === 'true';
  }, { timeout: 10000, interval: 500 });
}

/**
 * Ensure the overlay is open. If closed, toggle it open and wait.
 */
export async function ensureOverlayOpen() {
  const state = await queryState();
  if (!state.overlayOpen) {
    toggle();
    await waitFor(async () => {
      const s = await queryState();
      return s.overlayOpen === true;
    }, { timeout: 8000, interval: 300 });
  }
}

/**
 * Ensure the overlay is closed. If open, toggle it closed and wait.
 */
export async function ensureOverlayClosed() {
  const state = await queryState();
  if (state.overlayOpen) {
    toggle();
    await waitFor(async () => {
      const s = await queryState();
      return s.overlayOpen === false;
    }, { timeout: 5000, interval: 200 });
  }
}

/**
 * Ensure playback is paused. If playing, click play button to pause.
 */
export async function ensurePaused() {
  const state = await queryState();
  if (state.isPlaying) {
    clickOverlay('.sr-btn-play');
    await waitFor(async () => {
      const s = await queryState();
      return s.isPlaying === false;
    }, { timeout: 3000 });
  }
}

export { execJS, navigate, queryState, waitFor, toggle, dispatch, clickOverlay, TEST_URL };
