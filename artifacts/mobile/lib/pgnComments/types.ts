export type PgnCommentSource = 'repertoire' | 'gameLibrary';

export type PgnCommentSlot = 'start' | 'before' | 'after';

export type PgnCommentLanguage = 'en' | 'fr' | 'other' | 'unknown';

export type PgnTranslationStatus =
  | 'pending'
  | 'ready'
  | 'stale'
  | 'failed'
  | 'manual'
  | 'skipped';

export type PgnCommentAnchor = {
  source: PgnCommentSource;
  fileId: string;
  gameIndex: number;
  nodeId: string;
  slot: PgnCommentSlot;
};

export type PgnCommentUnit = {
  anchor: PgnCommentAnchor;
  original: string;
  fingerprint: string;
  language: PgnCommentLanguage;
  technicalOnly: boolean;
};

export type PgnCommentTranslationRecord = {
  id: string;
  anchor: PgnCommentAnchor;
  sourceLang: PgnCommentLanguage;
  targetLang: 'fr';
  originalFingerprint: string;
  originalText: string;
  translatedText: string;
  status: PgnTranslationStatus;
  method: 'automatic' | 'manual';
  previousManualText?: string;
  updatedAt: string;
};

export type PgnTranslationJob = {
  id: string;
  source: PgnCommentSource;
  fileId: string;
  gameIndex: number;
  commentId: string;
  fingerprint: string;
  original: string;
  context: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type PgnTranslationSnapshot = {
  version: 1;
  records: Record<string, PgnCommentTranslationRecord>;
};

export type PgnTranslationQueueSnapshot = {
  version: 1;
  jobs: Record<string, PgnTranslationJob>;
};

export type PgnTranslationProviderResult = {
  id: string;
  text?: string;
  error?: 'not_configured' | 'offline' | 'invalid' | 'rejected';
};

export type PgnTranslationProvider = {
  readonly configured: boolean;
  translateComments(
    batch: { id: string; text: string; context?: string }[],
  ): Promise<PgnTranslationProviderResult[]>;
};
