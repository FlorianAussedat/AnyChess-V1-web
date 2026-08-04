/**
 * Pure helpers for openings review routing (scope + training mode).
 */
import type { ReviewSideFilter, ReviewTrainingMode } from './MixedRepertoireTraining.ts';
import type { RepertoireFolder } from './storage/types.ts';
import { filterFoldersByReviewSide } from './MixedRepertoireTraining.ts';

export type ReviewLaunchScope = {
  folderIds: string[];
  side: ReviewSideFilter;
};

/** Resolve eligible folder ids for a review side filter. */
export function resolveReviewFolderIds(
  trainable: RepertoireFolder[],
  side: ReviewSideFilter,
): string[] {
  return filterFoldersByReviewSide(trainable, side).map((f) => f.id);
}

/** Canonicalize custom selection (stable order for URLs; recent keys sort separately). */
export function canonicalizeFolderIds(folderIds: string[]): string[] {
  return [...folderIds].sort();
}

export function buildContinueReviewHref(scope: ReviewLaunchScope): string {
  const ids = encodeURIComponent(scope.folderIds.join(','));
  return `/openings/continue?folderIds=${ids}&side=${scope.side}`;
}

export function buildBoardReviewHref(scope: ReviewLaunchScope): string {
  const ids = encodeURIComponent(scope.folderIds.join(','));
  return `/openings/play?folderIds=${ids}&side=${scope.side}`;
}

export function buildReviewHref(
  scope: ReviewLaunchScope,
  mode: ReviewTrainingMode,
): string {
  return mode === 'continue'
    ? buildContinueReviewHref(scope)
    : buildBoardReviewHref(scope);
}

/** Single-folder play URL with locked repertoire side color. */
export function buildFolderPlayHref(
  folderId: string,
  side: 'white' | 'black',
): string {
  const color = side === 'white' ? 'w' : 'b';
  return `/openings/play?folderId=${encodeURIComponent(folderId)}&color=${color}&sideLocked=1`;
}
