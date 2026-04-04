// tests/regression/01-prerequisites.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execJS, navigate, waitFor } from './helpers.js';

describe('Prerequisites', () => {
  it('Safari accepts JavaScript from Apple Events', () => {
    const result = execJS('1+1');
    assert.strictEqual(result, '2');
  });

  it('navigates to test page', async () => {
    await navigate();
    const url = execJS('window.location.href');
    assert.ok(url.includes('Speed_reading'), `Expected Speed_reading in URL, got: ${url}`);
  });

  it('content script is loaded', async () => {
    await waitFor(() => {
      const attr = execJS("document.documentElement.getAttribute('data-speedreader-loaded')");
      return attr === 'true';
    }, { timeout: 10000, interval: 500 });

    const attr = execJS("document.documentElement.getAttribute('data-speedreader-loaded')");
    assert.strictEqual(attr, 'true');
  });
});
