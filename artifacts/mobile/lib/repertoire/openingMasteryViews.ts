/**
 * Opening PGN mastery views — trainingPaths from buildRepertoire as source of truth.
 */
import type { ContinueLinePath } from '../continueLine/types.ts';
import { buildRepertoire } from './repertoireTree.ts';
import {
  getOpeningPgnMastery,
  isOpeningLineMastered,
  isPgnPriority,
  lastFiveRevisionResults,
  openingLineKey,
  type OpeningLearningCategory,
  type OpeningPgnMastery,
  type OpeningRevisionResult,
} from './openingMastery.ts';
import type { OpeningMasteryStore } from './OpeningMasteryStore.ts';
import { pgnFileDisplayName, type StoredPgnFile } from './storage/types.ts';

export type OpeningLineMasteryView = {
  path: ContinueLinePath;
  key: string;
  label: string;
  mastered: boolean;
  recent: OpeningRevisionResult[];
};

export type OpeningPgnMasteryView = OpeningPgnMastery & {
  fileId: string;
  displayName: string;
  priority: boolean;
  category: OpeningLearningCategory;
  paths: ContinueLinePath[];
  lines: OpeningLineMasteryView[];
};

function lineLabel(path: ContinueLinePath): string {
  if (path.sourceLabel?.trim()) return path.sourceLabel.trim();
  return path.sans.join(' ');
}

export function trainingPathsForPgn(pgnText: string): ContinueLinePath[] {
  return buildRepertoire(pgnText).trainingPaths ?? [];
}

export function describeOpeningPgnMastery(
  file: StoredPgnFile,
  store: OpeningMasteryStore,
): OpeningPgnMasteryView {
  const paths = trainingPathsForPgn(file.pgnText);
  const lines: OpeningLineMasteryView[] = paths.map((path) => {
    const recent = store.historyFor(file.id, path.id);
    return {
      path,
      key: openingLineKey(file.id, path.id),
      label: lineLabel(path),
      mastered: isOpeningLineMastered(recent),
      recent: lastFiveRevisionResults(recent),
    };
  });
  const masteredLines = lines.filter((line) => line.mastered).length;
  const mastery = getOpeningPgnMastery(masteredLines, lines.length);
  return {
    ...mastery,
    fileId: file.id,
    displayName: pgnFileDisplayName(file),
    priority: isPgnPriority(file),
    paths,
    lines,
  };
}
