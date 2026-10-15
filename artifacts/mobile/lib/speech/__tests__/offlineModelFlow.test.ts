import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRoomForModel,
  initialModelFlow,
  modelIsReady,
  networkKindFromState,
  partialFilePlan,
  reduceModelFlow,
} from '../offlineModelFlow.ts';
import { formatDownloadSize, tuneVoskModelConf } from '../voskModels.ts';

function offer(network: 'wifi' | 'cellular' | 'offline' | 'unknown' = 'wifi') {
  return reduceModelFlow(initialModelFlow(network), {
    type: 'offer',
    network,
    installed: false,
  }).state;
}

describe('offline model download flow', () => {
  it('explains the chosen language and does not start before agreement', () => {
    const asked = reduceModelFlow(initialModelFlow('wifi'), {
      type: 'offer',
      network: 'wifi',
      installed: false,
    });
    assert.equal(asked.state.phase, 'ask');
    assert.equal(asked.effect, 'none');
    assert.equal(asked.state.mobileAllowed, false);
  });

  it('starts on Wi-Fi only after the download button', () => {
    const started = reduceModelFlow(offer('wifi'), { type: 'download', network: 'wifi' });
    assert.equal(started.state.phase, 'downloading');
    assert.equal(started.effect, 'start');
    assert.equal(started.state.mobileAllowed, false);
  });

  it('asks before mobile data, and back is not consent', () => {
    const cellular = reduceModelFlow(offer('cellular'), { type: 'download', network: 'cellular' });
    assert.equal(cellular.state.phase, 'cellular-ask');
    assert.equal(cellular.effect, 'none');
    assert.equal(cellular.state.mobileAllowed, false);
    const dismissed = reduceModelFlow(cellular.state, { type: 'dismiss' });
    assert.equal(dismissed.state.phase, 'hidden');
    assert.equal(dismissed.state.mobileAllowed, false);
    assert.equal(dismissed.effect, 'none');
  });

  it('treats an unknown network like a metered link, not like Wi-Fi', () => {
    const unknown = reduceModelFlow(offer('unknown'), { type: 'download', network: 'unknown' });
    assert.equal(unknown.state.phase, 'cellular-ask');
    assert.equal(unknown.effect, 'none');
    assert.equal(networkKindFromState({ type: 'UNKNOWN', isConnected: true }), 'unknown');
    assert.equal(networkKindFromState({ type: 'VPN', isConnected: true }), 'unknown');
    assert.equal(networkKindFromState({ type: 'WIFI', isConnected: true }), 'wifi');
  });

  it('limits mobile consent to the download that was accepted', () => {
    const asked = reduceModelFlow(offer('cellular'), { type: 'download', network: 'cellular' }).state;
    const started = reduceModelFlow(asked, { type: 'download-mobile', network: 'cellular' });
    assert.equal(started.state.mobileAllowed, true);
    assert.equal(started.effect, 'start');
    const later = reduceModelFlow(started.state, {
      type: 'offer',
      network: 'cellular',
      installed: false,
    });
    assert.equal(later.state.mobileAllowed, false);
    assert.equal(later.state.phase, 'ask');
  });

  it('waits for Wi-Fi when mobile data is refused', () => {
    const asked = reduceModelFlow(offer('cellular'), { type: 'download', network: 'cellular' }).state;
    const waiting = reduceModelFlow(asked, { type: 'wait-wifi' });
    assert.equal(waiting.state.phase, 'waiting-wifi');
    assert.equal(waiting.state.mobileAllowed, false);
    const still = reduceModelFlow(waiting.state, { type: 'network', network: 'cellular' });
    assert.equal(still.state.phase, 'waiting-wifi');
    assert.equal(still.effect, 'none');
    const go = reduceModelFlow(still.state, { type: 'network', network: 'wifi' });
    assert.equal(go.state.phase, 'downloading');
    assert.equal(go.effect, 'start');
  });

  it('pauses a Wi-Fi transfer that moves to mobile data and asks if needed', () => {
    const started = reduceModelFlow(offer('wifi'), { type: 'download', network: 'wifi' }).state;
    const paused = reduceModelFlow(started, { type: 'network', network: 'cellular' });
    assert.equal(paused.effect, 'pause');
    assert.equal(paused.state.phase, 'cellular-ask');
    assert.equal(paused.state.mobileAllowed, false);
    const back = reduceModelFlow(paused.state, { type: 'dismiss' });
    assert.equal(back.state.phase, 'waiting-wifi');
    assert.equal(back.state.mobileAllowed, false);
    const resumed = reduceModelFlow(back.state, { type: 'network', network: 'wifi' });
    assert.equal(resumed.effect, 'start');
  });

  it('continues on mobile only after this download was already allowed', () => {
    let state = reduceModelFlow(offer('cellular'), { type: 'download', network: 'cellular' }).state;
    state = reduceModelFlow(state, { type: 'download-mobile', network: 'cellular' }).state;
    state = reduceModelFlow(state, { type: 'network', network: 'wifi' }).state;
    const again = reduceModelFlow(state, { type: 'network', network: 'cellular' });
    assert.equal(again.state.phase, 'downloading');
    assert.equal(again.effect, 'pause-resume');
    assert.equal(again.state.mobileAllowed, true);
  });

  it('does not download while offline, once cancelled, or when the model is ready', () => {
    const offline = reduceModelFlow(offer('offline'), { type: 'download', network: 'offline' });
    assert.equal(offline.state.phase, 'error');
    assert.equal(offline.state.reason, 'offline');
    const ready = reduceModelFlow(initialModelFlow('wifi'), {
      type: 'offer',
      network: 'wifi',
      installed: true,
    });
    assert.equal(ready.state.phase, 'hidden');
    assert.equal(ready.effect, 'none');
    const started = reduceModelFlow(offer('wifi'), { type: 'download', network: 'wifi' }).state;
    const cancelled = reduceModelFlow(started, { type: 'cancel' });
    assert.equal(cancelled.state.reason, 'cancelled');
    assert.equal(cancelled.state.mobileAllowed, false);
    const retry = reduceModelFlow(cancelled.state, { type: 'retry', network: 'cellular' });
    assert.equal(retry.state.phase, 'ask');
    assert.equal(retry.state.mobileAllowed, false);
  });

  it('is ready only after verification and a successful load', () => {
    assert.equal(modelIsReady({ verified: true, loaded: false }), false);
    assert.equal(modelIsReady({ verified: false, loaded: true }), false);
    assert.equal(modelIsReady({ verified: true, loaded: true }), true);
  });

  it('resumes a partial file and discards a corrupt or oversized one', () => {
    assert.equal(partialFilePlan({ installed: true, bytes: 10, expectedBytes: 40 }), 'ready');
    assert.equal(partialFilePlan({ installed: false, bytes: 0, expectedBytes: 40 }), 'fresh');
    assert.equal(partialFilePlan({ installed: false, bytes: 12, expectedBytes: 40 }), 'resume');
    assert.equal(
      partialFilePlan({ installed: false, bytes: 40, expectedBytes: 40, hash: 'match' }),
      'install',
    );
    assert.equal(
      partialFilePlan({ installed: false, bytes: 40, expectedBytes: 40, hash: 'mismatch' }),
      'discard',
    );
    assert.equal(partialFilePlan({ installed: false, bytes: 41, expectedBytes: 40 }), 'discard');
  });

  it('refuses to start when the free space cannot hold the zip and the model', () => {
    assert.equal(
      hasRoomForModel({ freeBytes: 200_000_000, downloadBytes: 42_000_000, installedBytes: 70_000_000 }),
      true,
    );
    assert.equal(
      hasRoomForModel({ freeBytes: 50_000_000, downloadBytes: 42_000_000, installedBytes: 70_000_000 }),
      false,
    );
  });

  it('shows the real archive size, not a rounded guess', () => {
    assert.equal(formatDownloadSize(42_233_323, 'fr'), `42${'\u202f'}233${'\u202f'}323 octets (42,2 Mo)`);
    assert.equal(formatDownloadSize(41_205_931, 'en'), `41${'\u202f'}205${'\u202f'}931 bytes (41.2 MB)`);
  });
});

describe('vosk decoder tune', () => {
  it('widens a tight English lattice and leaves the French one', () => {
    const english = '--beam=10.0\n--lattice-beam=2.0\n--max-active=3000\n';
    const french = '--beam=13.0\n--lattice-beam=4.0\n--max-active=7000\n';
    const tuned = tuneVoskModelConf(english);
    assert.match(tuned, /--beam=15\.0/);
    assert.match(tuned, /--lattice-beam=8\.0/);
    assert.match(tuned, /--max-active=7000/);
    assert.equal(tuneVoskModelConf(french), french);
  });
});
