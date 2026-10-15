/**
 * Download UI state for the offline dictation model.
 * The banner renders this. The microphone hook asks for a model when it is missing.
 */
import { getVoskModule, type VoskDownloadEvent } from './androidDictation.ts';
import { beginModelDownload, consentForDownloadPress, type NetworkKind } from './offlineModelFlow.ts';
import { VOSK_MODELS, type DictationLanguage } from './voskModels.ts';

export type OfflineModelView = {
  language: DictationLanguage;
  phase: 'ask' | 'downloading' | 'installing' | 'error';
  cellular: boolean;
  received: number;
  total: number;
  reason: 'network' | 'space' | 'integrity' | 'incompatible' | 'cancelled' | 'offline' | 'unknown';
};

type Listener = () => void;

let view: OfflineModelView | null = null;
const listeners = new Set<Listener>();
let progressSub: { remove(): void } | null = null;
let doneSub: { remove(): void } | null = null;

function emit(): void {
  for (const listener of listeners) listener();
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

export function dismissOfflineModel(): void {
  const native = getVoskModule();
  native?.cancelDownload();
  clearDownloadListeners();
  view = null;
  emit();
}

export function offerOfflineModel(language: DictationLanguage, network: NetworkKind): void {
  const flow = beginModelDownload({ ready: false, network, consent: 'none' });
  if (flow.step === 'blocked') {
    view = {
      language,
      phase: 'error',
      cellular: false,
      received: 0,
      total: 0,
      reason: 'offline',
    };
    emit();
    return;
  }
  view = {
    language,
    phase: 'ask',
    cellular: network === 'cellular',
    received: 0,
    total: 0,
    reason: 'unknown',
  };
  emit();
}

export async function confirmOfflineModelDownload(network: NetworkKind): Promise<void> {
  if (!view) return;
  const consent = consentForDownloadPress(view.cellular);
  const flow = beginModelDownload({ ready: false, network, consent });
  if (flow.step === 'ask') {
    view = { ...view, phase: 'ask', cellular: true };
    emit();
    return;
  }
  if (flow.step !== 'download') {
    view = {
      ...view,
      phase: 'error',
      reason: flow.step === 'blocked' ? 'offline' : 'unknown',
    };
    emit();
    return;
  }
  await runDownload(view.language);
}

async function runDownload(language: DictationLanguage): Promise<void> {
  const native = getVoskModule();
  const spec = VOSK_MODELS[language];
  if (!native) {
    view = view && {
      ...view,
      phase: 'error',
      reason: 'unknown',
    };
    emit();
    return;
  }
  const paths = native.paths(language);
  view = view && {
    ...view,
    phase: 'downloading',
    received: 0,
    total: spec.downloadMegabytes * 1_000_000,
    reason: 'unknown',
  };
  emit();
  clearDownloadListeners();
  progressSub = native.addListener('onProgress', (event) => {
    if (!view || view.phase !== 'downloading') return;
    view = { ...view, received: event.received, total: event.total > 0 ? event.total : view.total };
    emit();
  });
  const done = new Promise<VoskDownloadEvent>((resolve) => {
    doneSub = native.addListener('onDownloadDone', (event) => resolve(event));
  });
  await native.download(spec.url, paths.zip, spec.sha256);
  const result = await done;
  clearDownloadListeners();
  if (!result.ok) {
    const reason = (result.reason ?? 'unknown') as OfflineModelView['reason'];
    view = view && { ...view, phase: 'error', reason };
    emit();
    return;
  }
  view = view && { ...view, phase: 'installing' };
  emit();
  try {
    const modelPath = await native.install(paths.zip, paths.root, spec.sha256, spec.directory);
    await native.load(modelPath);
    view = null;
    emit();
  } catch (err) {
    const message = String(err).toLowerCase();
    const reason: OfflineModelView['reason'] = message.includes('integrity')
      ? 'integrity'
      : message.includes('incompatible')
        ? 'incompatible'
        : message.includes('space')
          ? 'space'
          : 'unknown';
    view = view && { ...view, phase: 'error', reason };
    emit();
  }
}

export function retryOfflineModel(network: NetworkKind): void {
  if (!view) return;
  view = { ...view, phase: 'ask', cellular: network === 'cellular', reason: 'unknown' };
  emit();
}
