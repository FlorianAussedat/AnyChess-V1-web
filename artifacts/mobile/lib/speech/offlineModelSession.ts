/**
 * Download UI state for one offline dictation model.
 * The banner renders this. The microphone hook asks for the chosen language only.
 * Mobile consent is kept in this session, not in account sync settings.
 */
import { getVoskModule, type VoskDownloadEvent } from './androidDictation.ts';
import {
  hasRoomForModel,
  initialModelFlow,
  reduceModelFlow,
  type DownloadReason,
  type ModelFlowEffect,
  type ModelFlowEvent,
  type ModelFlowState,
  type NetworkKind,
} from './offlineModelFlow.ts';
import { VOSK_MODELS, type DictationLanguage } from './voskModels.ts';

export type OfflineModelView = {
  language: DictationLanguage;
  phase: 'ask' | 'cellular-ask' | 'waiting-wifi' | 'downloading' | 'installing' | 'error';
  received: number;
  total: number;
  reason: DownloadReason;
};

type Listener = () => void;

let flow: ModelFlowState = initialModelFlow();
let language: DictationLanguage = 'fr';
let view: OfflineModelView | null = null;
const listeners = new Set<Listener>();
let progressSub: { remove(): void } | null = null;
let doneSub: { remove(): void } | null = null;
let generation = 0;
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
      total: view && view.language === language && view.total > 0
        ? view.total
        : spec.downloadBytes,
      reason: flow.reason,
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
  const installed = native?.status(nextLanguage, spec.directory) === 'installed';
  runEffect(apply({ type: 'offer', network, installed: installed === true }));
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
  runEffect(apply({ type: 'retry', network }));
}

/** Called while a transfer is running or waiting, including Wi-Fi to mobile. */
export function noteOfflineNetwork(network: NetworkKind): void {
  runEffect(apply({ type: 'network', network }));
}

async function runDownload(): Promise<void> {
  const gen = ++generation;
  resumeAfterPause = false;
  const native = getVoskModule();
  const spec = VOSK_MODELS[language];
  if (!native) {
    apply({ type: 'received', ok: false, reason: 'unknown' });
    return;
  }
  const free = native.freeBytes?.() ?? null;
  if (free != null && !hasRoomForModel({
    freeBytes: free,
    downloadBytes: spec.downloadBytes,
    installedBytes: spec.installedBytes,
  })) {
    apply({ type: 'no-space' });
    return;
  }
  const paths = native.paths(language);
  view = view && { ...view, phase: 'downloading', received: 0, total: spec.downloadBytes };
  emit();
  clearDownloadListeners();
  progressSub = native.addListener('onProgress', (event) => {
    if (gen !== generation || !view || view.phase !== 'downloading') return;
    view = {
      ...view,
      received: event.received,
      total: event.total > 0 ? event.total : view.total,
    };
    emit();
  });
  const done = new Promise<VoskDownloadEvent>((resolve) => {
    doneSub = native.addListener('onDownloadDone', (event) => resolve(event));
  });
  await native.download(spec.url, paths.zip, spec.sha256);
  const result = await done;
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
  apply({ type: 'received', ok: true });
  try {
    const modelPath = await native.install(paths.zip, paths.root, spec.sha256, spec.directory);
    if (gen !== generation) return;
    await native.load(modelPath);
    if (gen !== generation) return;
    apply({ type: 'installed' });
  } catch (err) {
    if (gen !== generation) return;
    const message = String(err).toLowerCase();
    const reason: DownloadReason = message.includes('integrity')
      ? 'integrity'
      : message.includes('incompatible')
        ? 'incompatible'
        : message.includes('space')
          ? 'space'
          : 'unknown';
    apply({ type: 'install-failed', reason });
  }
}

/** Test hook. Production code leaves the session module-scoped. */
export function resetOfflineModelSessionForTests(): void {
  generation += 1;
  clearDownloadListeners();
  flow = initialModelFlow();
  view = null;
  resumeAfterPause = false;
}
