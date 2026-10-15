import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { beginModelDownload, consentForDownloadPress, modelIsReady } from '../offlineModelFlow.ts';

describe('offline model download flow', () => {
  it('never starts a download without confirmation', () => {
    assert.deepEqual(
      beginModelDownload({ ready: false, network: 'wifi', consent: 'none' }),
      { step: 'ask', cellular: false },
    );
  });

  it('asks again on mobile data', () => {
    assert.deepEqual(
      beginModelDownload({
        ready: false,
        network: 'cellular',
        consent: consentForDownloadPress(false),
      }),
      { step: 'ask', cellular: true },
    );
    assert.deepEqual(
      beginModelDownload({
        ready: false,
        network: 'cellular',
        consent: consentForDownloadPress(true),
      }),
      { step: 'download' },
    );
  });

  it('does not download while offline or once the model is ready', () => {
    assert.deepEqual(
      beginModelDownload({ ready: false, network: 'offline', consent: 'confirmed' }),
      { step: 'blocked', reason: 'offline' },
    );
    assert.deepEqual(
      beginModelDownload({ ready: true, network: 'wifi', consent: 'none' }),
      { step: 'ready' },
    );
  });

  it('is ready only after verification and a successful load', () => {
    assert.equal(modelIsReady({ verified: true, loaded: false }), false);
    assert.equal(modelIsReady({ verified: false, loaded: true }), false);
    assert.equal(modelIsReady({ verified: true, loaded: true }), true);
  });
});
