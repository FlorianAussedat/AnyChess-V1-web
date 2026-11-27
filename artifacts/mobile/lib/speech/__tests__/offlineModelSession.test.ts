import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  setVoskModuleForTests,
  type VoskAsrNative,
  type VoskDownloadEvent,
  type VoskProgressEvent,
} from '../androidDictation.ts';
import type { ModelLocalStatus } from '../offlineModelFlow.ts';
import {
  cancelOfflineModel,
  getOfflineModelView,
  offerOfflineModel,
  requestOfflineDownload,
  resetOfflineModelSessionForTests,
  retryOfflineModel,
  subscribeOfflineModel,
} from '../offlineModelSession.ts';
import { VOSK_MODELS } from '../voskModels.ts';

type ListenerMap = {
  onProgress: Set<(event: VoskProgressEvent) => void>;
  onDownloadDone: Set<(event: VoskDownloadEvent) => void>;
};

function createFakeNative(opts?: {
  statusByLang?: Partial<Record<'fr' | 'en', ModelLocalStatus>>;
  downloadThrows?: Error | null;
  loadThrowsOnce?: boolean;
  installThrows?: Error | null;
}) {
  const listeners: ListenerMap = {
    onProgress: new Set(),
    onDownloadDone: new Set(),
  };
  const statusByLang: Record<string, ModelLocalStatus> = {
    fr: opts?.statusByLang?.fr ?? 'missing',
    en: opts?.statusByLang?.en ?? 'missing',
  };
  let loads = 0;
  let lastTransferId: number | undefined;
  let downloadCalls = 0;
  let loadCalls = 0;
  let installCalls = 0;
  let cancelCalls = 0;

  const native: VoskAsrNative = {
    download: mock.fn(async (_url, _dest, _sha, transferId?: number) => {
      downloadCalls += 1;
      lastTransferId = transferId;
      if (opts?.downloadThrows) throw opts.downloadThrows;
    }),
    cancelDownload: mock.fn(() => {
      cancelCalls += 1;
    }),
    pauseDownload: mock.fn(() => {
      cancelCalls += 1;
    }),
    freeBytes: () => 500_000_000,
    zipBytes: () => 0,
    install: mock.fn(async (zipPath, destDir, _sha, directory) => {
      installCalls += 1;
      if (opts?.installThrows) throw opts.installThrows;
      statusByLang[directory.includes('en') ? 'en' : 'fr'] = 'unpacked';
      return `${destDir}/${directory}`;
    }),
    load: mock.fn(async (path: string) => {
      loadCalls += 1;
      loads += 1;
      if (opts?.loadThrowsOnce && loads === 1) {
        throw new Error('load failed');
      }
      const lang = path.includes('en-us') || path.includes('/en/') ? 'en' : 'fr';
      statusByLang[lang] = 'installed';
    }),
    setGrammar: mock.fn(() => {}),
    hasMicPermission: () => true,
    start: mock.fn(async () => {}),
    stop: mock.fn(() => {}),
    paths: (language: string) => ({
      zip: `/tmp/vosk/${language}.download.zip`,
      root: `/tmp/vosk/${language}`,
    }),
    status: (language: string) => statusByLang[language] ?? 'missing',
    addListener: (event, listener) => {
      if (event === 'onProgress') {
        listeners.onProgress.add(listener as (event: VoskProgressEvent) => void);
        return {
          remove: () => listeners.onProgress.delete(listener as (event: VoskProgressEvent) => void),
        };
      }
      if (event === 'onDownloadDone') {
        listeners.onDownloadDone.add(listener as (event: VoskDownloadEvent) => void);
        return {
          remove: () =>
            listeners.onDownloadDone.delete(listener as (event: VoskDownloadEvent) => void),
        };
      }
      return { remove: () => {} };
    },
  };

  return {
    native,
    get downloadCalls() {
      return downloadCalls;
    },
    get loadCalls() {
      return loadCalls;
    },
    get installCalls() {
      return installCalls;
    },
    get cancelCalls() {
      return cancelCalls;
    },
    get lastTransferId() {
      return lastTransferId;
    },
    setStatus(language: 'fr' | 'en', status: ModelLocalStatus) {
      statusByLang[language] = status;
    },
    emitProgress(event: VoskProgressEvent) {
      for (const l of listeners.onProgress) l(event);
    },
    emitDone(event: VoskDownloadEvent) {
      for (const l of listeners.onDownloadDone) l(event);
    },
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function waitForPhase(
  phase: string,
  timeoutMs = 1000,
): Promise<ReturnType<typeof getOfflineModelView>> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const view = getOfflineModelView();
      if (view?.phase === phase) {
        resolve(view);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`timeout waiting for phase ${phase}, got ${view?.phase ?? 'null'}`));
        return;
      }
      setTimeout(check, 5);
    };
    const unsub = subscribeOfflineModel(() => {
      const view = getOfflineModelView();
      if (view?.phase === phase) {
        unsub();
        resolve(view);
      }
    });
    check();
  });
}

describe('offline model session', () => {
  beforeEach(() => {
    resetOfflineModelSessionForTests();
    setVoskModuleForTests(undefined);
  });

  afterEach(() => {
    resetOfflineModelSessionForTests();
    setVoskModuleForTests(undefined);
  });

  it('installs FR then EN on first request (download → verify → install → load → ready)', async () => {
    const fake = createFakeNative();
    setVoskModuleForTests(fake.native);

    offerOfflineModel('fr', 'wifi');
    assert.equal(getOfflineModelView()?.phase, 'ask');
    requestOfflineDownload('wifi');
    await flush();
    const frId = fake.lastTransferId;
    assert.equal(typeof frId, 'number');
    fake.emitDone({ ok: true, transferId: frId, path: '/tmp/vosk/fr.download.zip' });
    await waitForPhase('ready');
    assert.equal(fake.downloadCalls, 1);
    assert.equal(fake.installCalls, 1);
    assert.equal(fake.loadCalls, 1);

    resetOfflineModelSessionForTests();
    fake.setStatus('en', 'missing');
    offerOfflineModel('en', 'wifi');
    requestOfflineDownload('wifi');
    await flush();
    const enId = fake.lastTransferId;
    fake.emitDone({ ok: true, transferId: enId, path: '/tmp/vosk/en.download.zip' });
    await waitForPhase('ready');
    assert.equal(fake.downloadCalls, 2);
    assert.equal(fake.loadCalls, 2);
  });

  it('reuses an already installed model without downloading', () => {
    const fake = createFakeNative({ statusByLang: { fr: 'installed' } });
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    assert.equal(getOfflineModelView(), null);
    assert.equal(fake.downloadCalls, 0);
  });

  it('prepares an unpacked model without re-downloading', async () => {
    const fake = createFakeNative({ statusByLang: { fr: 'unpacked' } });
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    assert.equal(getOfflineModelView()?.repairOnly, true);
    requestOfflineDownload('wifi');
    await waitForPhase('ready');
    assert.equal(fake.downloadCalls, 0);
    assert.equal(fake.loadCalls, 1);
  });

  it('cancels then resumes with a fresh transfer id', async () => {
    const fake = createFakeNative();
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    requestOfflineDownload('wifi');
    await flush();
    const staleId = fake.lastTransferId;
    cancelOfflineModel();
    assert.equal(getOfflineModelView()?.reason, 'cancelled');

    retryOfflineModel('wifi');
    requestOfflineDownload('wifi');
    await flush();
    const freshId = fake.lastTransferId;
    assert.notEqual(freshId, staleId);
    fake.emitProgress({
      received: 1,
      total: VOSK_MODELS.fr.downloadBytes,
      transferId: staleId,
    });
    assert.equal(getOfflineModelView()?.received ?? 0, 0);
    fake.emitDone({ ok: true, transferId: freshId });
    await waitForPhase('ready');
    assert.equal(fake.loadCalls, 1);
  });

  it('surfaces a native download launch failure instead of staying at zero', async () => {
    const fake = createFakeNative({ downloadThrows: new Error('ENETUNREACH network') });
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    requestOfflineDownload('wifi');
    await waitForPhase('error');
    assert.equal(getOfflineModelView()?.reason, 'network');
  });

  it('maps a corrupt archive to an integrity failure', async () => {
    const fake = createFakeNative({ installThrows: new Error('integrity') });
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    requestOfflineDownload('wifi');
    await flush();
    fake.emitDone({ ok: true, transferId: fake.lastTransferId });
    await waitForPhase('error');
    assert.equal(getOfflineModelView()?.reason, 'integrity');
  });

  it('refuses to start when free space is insufficient', async () => {
    const fake = createFakeNative();
    fake.native.freeBytes = () => 1_000_000;
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    requestOfflineDownload('wifi');
    await waitForPhase('error');
    assert.equal(getOfflineModelView()?.reason, 'space');
    assert.equal(fake.downloadCalls, 0);
  });

  it('keeps a local repair path after a native load failure', async () => {
    const fake = createFakeNative({
      statusByLang: { fr: 'unpacked' },
      loadThrowsOnce: true,
    });
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    requestOfflineDownload('wifi');
    await waitForPhase('error');
    assert.equal(getOfflineModelView()?.reason, 'load');
    assert.equal(getOfflineModelView()?.repairOnly, true);
    assert.equal(fake.downloadCalls, 0);

    retryOfflineModel('wifi');
    requestOfflineDownload('wifi');
    await waitForPhase('ready');
    assert.equal(fake.downloadCalls, 0);
    assert.equal(fake.loadCalls, 2);
  });

  it('ignores late complete events from a previous transfer id', async () => {
    const fake = createFakeNative();
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    requestOfflineDownload('wifi');
    await flush();
    const activeId = fake.lastTransferId ?? 0;
    fake.emitDone({ ok: true, transferId: activeId - 99 });
    assert.equal(getOfflineModelView()?.phase, 'downloading');
    fake.emitDone({ ok: true, transferId: activeId });
    await waitForPhase('ready');
    assert.equal(fake.loadCalls, 1);
  });

  it('switches language without mixing transfers', async () => {
    const fake = createFakeNative();
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    requestOfflineDownload('wifi');
    await flush();
    const frId = fake.lastTransferId;
    cancelOfflineModel();

    retryOfflineModel('wifi');
    offerOfflineModel('en', 'wifi');
    requestOfflineDownload('wifi');
    await flush();
    const enId = fake.lastTransferId;
    assert.notEqual(enId, frId);
    fake.emitDone({ ok: true, transferId: frId });
    assert.notEqual(getOfflineModelView()?.phase, 'ready');
    fake.emitDone({ ok: true, transferId: enId });
    await waitForPhase('ready');
    assert.equal(getOfflineModelView()?.language, 'en');
  });

  it('treats a post-restart installed model as ready without network', () => {
    const fake = createFakeNative({ statusByLang: { fr: 'installed' } });
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'offline');
    assert.equal(getOfflineModelView(), null);
    assert.equal(fake.downloadCalls, 0);
  });

  it('works in airplane mode when the model is already installed', () => {
    const fake = createFakeNative({ statusByLang: { fr: 'installed', en: 'installed' } });
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'offline');
    offerOfflineModel('en', 'offline');
    assert.equal(getOfflineModelView(), null);
  });

  it('preserves installed models across a simulated APK-compatible restart', () => {
    const fake = createFakeNative({ statusByLang: { fr: 'installed', en: 'installed' } });
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    resetOfflineModelSessionForTests();
    offerOfflineModel('en', 'wifi');
    assert.equal(getOfflineModelView(), null);
    assert.equal(fake.downloadCalls, 0);
  });

  it('maps a native download error event (corrupt / network) to a clear failure', async () => {
    const fake = createFakeNative();
    setVoskModuleForTests(fake.native);
    offerOfflineModel('fr', 'wifi');
    requestOfflineDownload('wifi');
    await flush();
    fake.emitDone({
      ok: false,
      reason: 'integrity',
      transferId: fake.lastTransferId,
    });
    await waitForPhase('error');
    assert.equal(getOfflineModelView()?.reason, 'integrity');
  });
});
