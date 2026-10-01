import type { AppLanguage } from '../preferences/types.ts';
import { fingerprintComment } from './fingerprint.ts';
import {
  PgnCommentTranslationStore,
  pgnCommentTranslationStore,
} from './PgnCommentTranslationStore.ts';
import type { PgnCommentAnchor } from './types.ts';

export function hasUsableFrenchTranslation(
  anchor: PgnCommentAnchor,
  original: string,
  translations: PgnCommentTranslationStore = pgnCommentTranslationStore,
): boolean {
  const rec = translations.resolveFrench(anchor, original);
  if (!rec?.translatedText?.trim()) return false;
  if (rec.originalFingerprint !== fingerprintComment(original)) return false;
  return rec.status === 'ready' || rec.status === 'manual';
}

export type CommentDisplayMode = 'auto' | 'original' | 'french';

export type ResolvedPgnComment = {
  text: string;
  showing: 'original' | 'french';
  status:
    | 'original'
    | 'ready'
    | 'pending'
    | 'unavailable'
    | 'stale'
    | 'manual';
};

export function resolvePgnComment(
  anchor: PgnCommentAnchor,
  original: string,
  language: AppLanguage,
  mode: CommentDisplayMode = 'auto',
  translations: PgnCommentTranslationStore = pgnCommentTranslationStore,
): ResolvedPgnComment {
  const rec = translations.resolveFrench(anchor, original);
  const wantFrench =
    mode === 'french' || (mode === 'auto' && language === 'fr');

  if (!wantFrench) {
    return { text: original, showing: 'original', status: 'original' };
  }
  if (!rec) {
    return { text: original, showing: 'original', status: 'unavailable' };
  }
  if (rec.status === 'stale' || rec.originalFingerprint !== fingerprintComment(original)) {
    return { text: original, showing: 'original', status: 'stale' };
  }
  if (rec.status === 'pending' || rec.status === 'failed' || rec.status === 'skipped') {
    return { text: original, showing: 'original', status: rec.status === 'pending' ? 'pending' : 'unavailable' };
  }
  if (!rec.translatedText) {
    return { text: original, showing: 'original', status: 'unavailable' };
  }
  return {
    text: rec.translatedText,
    showing: 'french',
    status: rec.method === 'manual' ? 'manual' : 'ready',
  };
}
