import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('firstActivation signaling', () => {
  let storageState;
  let nativeMessages;

  // Minimal browser mock
  const browser = {
    storage: {
      local: {
        get: async (defaults) => ({ ...defaults, ...storageState }),
        set: async (obj) => { Object.assign(storageState, obj); },
      },
    },
    runtime: {
      sendNativeMessage: async (appId, message) => {
        nativeMessages.push({ appId, message });
        return { status: 'ok' };
      },
    },
  };

  beforeEach(() => {
    storageState = {};
    nativeMessages = [];
  });

  // Extract the signaling logic into a testable function
  async function signalFirstActivationIfNeeded(browserApi) {
    const result = await browserApi.storage.local.get({ hasReportedFirstActivation: false });
    if (!result.hasReportedFirstActivation) {
      await browserApi.runtime.sendNativeMessage(
        'com.chriscantu.SpeedReader',
        { action: 'firstActivation' }
      );
      await browserApi.storage.local.set({ hasReportedFirstActivation: true });
    }
  }

  it('sends firstActivation on first toggle', async () => {
    await signalFirstActivationIfNeeded(browser);
    assert.strictEqual(nativeMessages.length, 1);
    assert.deepStrictEqual(nativeMessages[0].message, { action: 'firstActivation' });
  });

  it('sets hasReportedFirstActivation flag after sending', async () => {
    await signalFirstActivationIfNeeded(browser);
    assert.strictEqual(storageState.hasReportedFirstActivation, true);
  });

  it('does not send on subsequent toggles', async () => {
    storageState.hasReportedFirstActivation = true;
    await signalFirstActivationIfNeeded(browser);
    assert.strictEqual(nativeMessages.length, 0);
  });
});
