/**
 * Download UI state for one offline dictation model.
 * The banner renders this. The microphone hook asks for the chosen language only.
 * Mobile consent is kept in this session, not in account sync settings.
 */
import {
  getVoskModule,
  readModelLocalStatus,
  startVoskDownload,
  type VoskDownloadEvent,
} from './androidDictation.ts';
import {
  hasRoomForModel,
  initialModelFlow,
  partialFilePlan,
  reduceModelFlow,
  type DownloadReason,
  type DownloadPhase,
  type ModelFlowEffect,
  type ModelFlowEvent,
  type ModelFlowState,
  type NetworkKind,
} from './offlineModelFlow.ts';
import { VOSK_MODELS, type DictationLanguage } from './voskModels.ts';

export type OfflineModelView = {
  language: DictationLanguage;
  phase: Exclude<DownloadPhase, 'hidden'>;
  received: number;
  total: number;
  reason: DownloadReason;
  repairOnly: boolean;
};

type Listener = () => void;

let flow: ModelFlowState = initialModelFlow();
let language: DictationLanguage = 'fr';
let view: OfflineModelView | null = null;
const listeners = new Set<Listener>();
let progressSub: { remove(): void } | null = null;
let doneSub: { remove(): void } | null = null;
let downloadWatchdog: ReturnType<typeof setTimeout> | null = null;
/** Rejects the in-flight download waiter when the transfer is cancelled or superseded. */
let rejectDownloadWait: ((err: Error) => void) | null = null;
let generation = 0;
let transferSeq = 0;
let resumeAfterPause = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function publish(): void {
  if (flow.phase === 'hidden') {
    view = null;
  } else {
    const spec = VOSK_MODELS[language];
    view = {
      language,
      phase: flow.phase,
      received: view && view.language === language ? view.received : 0,
      total:
        view && view.language === language && view.total > 0
          ? view.total
          : spec.downloadBytes,
      reason: flow.reason,
      repairOnly: flow.repairOnly,
    };
  }
  emit();
}

export function getOfflineModelView(): OfflineModelView | null {
  return view;
}

export function subscribeOfflineModel(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clearDownloadListeners(): void {
  progressSub?.remove();
  doneSub?.remove();
  progressSub = null;
  doneSub = null;
  if (downloadWatchdog) {
    clearTimeout(downloadWatchdog);
    downloadWatchdog = null;
  }
  if (rejectDownloadWait) {
    const reject = rejectDownloadWait;
    rejectDownloadWait = null;
    reject(new Error('cancelled'));
  }
}

function apply(event: ModelFlowEvent): ModelFlowEffect {
  const reduced = reduceModelFlow(flow, event);
  flow = reduced.state;
  publish();
  return reduced.effect;
}

function runEffect(effect: ModelFlowEffect): void {
  if (effect === 'start') {
    void runDownload();
    return;
  }
  if (effect === 'prepare') {
    void runPrepareOnly();
    return;
  }
  if (effect === 'pause' || effect === 'pause-resume') {
    resumeAfterPause = effect === 'pause-resume';
    const native = getVoskModule();
    if (native?.pauseDownload) native.pauseDownload();
    else native?.cancelDownload();
  }
}

export function offerOfflineModel(nextLanguage: DictationLanguage, network: NetworkKind): void {
  language = nextLanguage;
  const native = getVoskModule();
  const spec = VOSK_MODELS[nextLanguage];
  const status = readModelLocalStatus(native, nextLanguage, spec.directory);
  runEffect(apply({ type: 'offer', network, status }));
}

export function requestOfflineDownload(network: NetworkKind): void {
  runEffect(apply({ type: 'download', network }));
}

export function requestOfflineMobileDownload(network: NetworkKind): void {
  runEffect(apply({ type: 'download-mobile', network }));
}

export function waitOfflineForWifi(): void {
  runEffect(apply({ type: 'wait-wifi' }));
}

export function dismissOfflineModel(): void {
  runEffect(apply({ type: 'dismiss' }));
  if (flow.phase === 'hidden') {
    generation += 1;
    clearDownloadListeners();
  }
}

export function cancelOfflineModel(): void {
  runEffect(apply({ type: 'cancel' }));
  generation += 1;
  clearDownloadListeners();
}

export function retryOfflineModel(network: NetworkKind): void {
  generation += 1;
  clearDownloadListeners();
  const native = getVoskModule();
  const spec = VOSK_MODELS[language];
  const status = readModelLocalStatus(native, language, spec.directory);
  if (status === 'unpacked') {
    flow = { ...flow, repairOnly: true };
  }
  runEffect(apply({ type: 'retry', network }));
}

/** Called while a transfer is running or waiting, including Wi-Fi to mobile. */
export function noteOfflineNetwork(network: NetworkKind): void {
  runEffect(apply({ type: 'network', network }));
}

function reasonFromError(err: unknown): DownloadReason {
  const message = String(err).toLowerCase();
  if (message.includes('integrity')) return 'integrity';
  if (message.includes('incompatible')) return 'incompatible';
  if (message.includes('space') || message.includes('enospc')) return 'space';
  if (message.includes('load') || message.includes('model')) return 'load';
  if (message.includes('offline') || message.includes('network')) return 'network';
  return 'unknown';
}

async function loadInstalledModel(native: NonNullable<ReturnType<typeof getVoskModule>>): Promise<void> {
  const spec = VOSK_MODELS[language];
  const paths = native.paths(language);
  apply({ type: 'preparing' });
  await native.load(`${paths.root}/${spec.directory}`);
}

async function runPrepareOnly(): Promise<void> {
  const gen = ++generation;
  const native = getVoskModule();
  if (!native) {
    apply({ type: 'install-failed', reason: 'unknown' });
    return;
  }
  try {
    await loadInstalledModel(native);
    if (gen !== generation) return;
    apply({ type: 'installed' });
  } catch (err) {
    if (gen !== generation) return;
    apply({ type: 'install-failed', reason: reasonFromError(err) === 'unknown' ? 'load' : reasonFromError(err) });
  }
}

async function runDownload(): Promise<void> {
  const gen = ++generation;
  const transferId = ++transferSeq;
  resumeAfterPause = false;
  const native = getVoskModule();
  const spec = VOSK_MODELS[language];
  if (!native) {
    apply({ type: 'received', ok: false, reason: 'unknown' });
    return;
  }

  try {
    const status = readModelLocalStatus(native, language, spec.directory);
    if (status === 'installed') {
      apply({ type: 'installed' });
      return;
    }
    if (status === 'unpacked') {
      await loadInstalledModel(native);
      if (gen !== generation) return;
      apply({ type: 'installed' });
      return;
    }

    const paths = native.paths(language);
    const zipBytes = native.zipBytes?.(language) ?? 0;
    const plan = partialFilePlan({
      installed: false,
      unpacked: false,
      bytes: zipBytes,
      expectedBytes: spec.downloadBytes,
      hash: 'unknown',
    });

    if (plan === 'discard' && native.zipBytes) {
      // Oversized/corrupt partial: native download resumes or replaces.
    }

    const free = native.freeBytes?.() ?? null;
    if (
      free != null &&
      !hasRoomForModel({
        freeBytes: free,
        downloadBytes: spec.downloadBytes,
        installedBytes: spec.installedBytes,
        partialBytes: zipBytes > 0 && zipBytes < spec.downloadBytes ? zipBytes : 0,
      })
    ) {
      apply({ type: 'no-space' });
      return;
    }

    view = view && {
      ...view,
      phase: 'downloading',
      received: zipBytes > 0 && zipBytes < spec.downloadBytes ? zipBytes : 0,
      total: spec.downloadBytes,
    };
    emit();
    clearDownloadListeners();

    progressSub = native.addListener('onProgress', (event) => {
      if (gen !== generation || !view || view.phase !== 'downloading') return;
      if (event.transferId != null && event.transferId !== transferId) return;
      view = {
        ...view,
        received: event.received,
        total: event.total > 0 ? event.total : view.total,
      };
      emit();
    });

    const done = new Promise<VoskDownloadEvent>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        rejectDownloadWait = null;
        if (downloadWatchdog) {
          clearTimeout(downloadWatchdog);
          downloadWatchdog = null;
        }
        fn();
      };
      if (downloadWatchdog) clearTimeout(downloadWatchdog);
      downloadWatchdog = setTimeout(() => {
        downloadWatchdog = null;
        finish(() => reject(new Error('network')));
      }, 15 * 60 * 1000);
      rejectDownloadWait = (err) => finish(() => reject(err));
      doneSub = native.addListener('onDownloadDone', (event) => {
        if (event.transferId != null && event.transferId !== transferId) return;
        finish(() => resolve(event));
      });
    });

    try {
      await startVoskDownload(native, spec.url, paths.zip, spec.sha256, transferId);
    } catch (err) {
      if (gen !== generation) return;
      // Drop the waiter without rejecting — nothing is awaiting `done` yet.
      rejectDownloadWait = null;
      clearDownloadListeners();
      apply({ type: 'received', ok: false, reason: reasonFromError(err) });
      return;
    }

    let result: VoskDownloadEvent;
    try {
      result = await done;
    } catch (err) {
      if (gen !== generation) return;
      rejectDownloadWait = null;
      clearDownloadListeners();
      apply({ type: 'received', ok: false, reason: reasonFromError(err) });
      return;
    }

    if (gen !== generation) return;
    clearDownloadListeners();

    if (!result.ok && result.reason === 'paused') {
      if (resumeAfterPause && flow.phase === 'downloading' && flow.mobileAllowed) {
        resumeAfterPause = false;
        void runDownload();
      }
      return;
    }
    if (!result.ok) {
      const reason = (result.reason ?? 'unknown') as DownloadReason;
      apply({ type: 'received', ok: false, reason });
      return;
    }

    // received → verifying so the banner can paint before the long unpack.
    apply({ type: 'received', ok: true });
    apply({ type: 'verifying' });
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    if (gen !== generation) return;
    apply({ type: 'installing' });
    const modelPath = await native.install(paths.zip, paths.root, spec.sha256, spec.directory);
    if (gen !== generation) return;
    apply({ type: 'preparing' });
    await native.load(modelPath);
    if (gen !== generation) return;
    apply({ type: 'installed' });
  } catch (err) {
    if (gen !== generation) return;
    clearDownloadListeners();
    if (flow.phase === 'downloading') {
      apply({ type: 'received', ok: false, reason: reasonFromError(err) });
      return;
    }
    apply({
      type: 'install-failed',
      reason: reasonFromError(err) === 'unknown' ? 'load' : reasonFromError(err),
    });
  }
}

/** Test hook. Production code leaves the session module-scoped. */
export function resetOfflineModelSessionForTests(): void {
  generation += 1;
  clearDownloadListeners();
  flow = initialModelFlow();
  view = null;
  resumeAfterPause = false;
  transferSeq = 0;
}
