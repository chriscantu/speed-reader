import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('firstActivation signaling', () => {
  let storageState;
  let nativeMessages;

  // Minimal browser mock — mirrors logic from background.js, keep in sync.
  function makeBrowser({ nativeMessageShouldFail = false } = {}) {
    return {
      storage: {
        local: {
          get: async (defaults) => ({ ...defaults, ...storageState }),
          set: async (obj) => { Object.assign(storageState, obj); },
        },
      },
      runtime: {
        sendNativeMessage: async (appId, message) => {
          if (nativeMessageShouldFail) {
            throw new Error('Native messaging unavailable');
          }
          nativeMessages.push({ appId, message });
          return { status: 'ok' };
        },
      },
    };
  }

  beforeEach(() => {
    storageState = {};
    nativeMessages = [];
  });

  // Mirrors the signaling logic in background.js — keep in sync.
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
    await signalFirstActivationIfNeeded(makeBrowser());
    assert.strictEqual(nativeMessages.length, 1);
    assert.deepStrictEqual(nativeMessages[0].message, { action: 'firstActivation' });
  });

  it('sets hasReportedFirstActivation flag after sending', async () => {
    await signalFirstActivationIfNeeded(makeBrowser());
    assert.strictEqual(storageState.hasReportedFirstActivation, true);
  });

  it('does not send on subsequent toggles', async () => {
    storageState.hasReportedFirstActivation = true;
    await signalFirstActivationIfNeeded(makeBrowser());
    assert.strictEqual(nativeMessages.length, 0);
  });

  it('does not set flag when native message fails', async () => {
    const failingBrowser = makeBrowser({ nativeMessageShouldFail: true });
    await assert.rejects(
      () => signalFirstActivationIfNeeded(failingBrowser),
      { message: 'Native messaging unavailable' }
    );
    assert.strictEqual(storageState.hasReportedFirstActivation, undefined);
  });
});
