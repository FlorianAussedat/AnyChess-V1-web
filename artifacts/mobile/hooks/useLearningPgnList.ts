import { useMemo, useState } from 'react';
import type { RepertoireFolder, StoredPgnFile } from '@/lib/repertoire';
import {
  describeOpeningPgnMastery,
  isFileVisibleInLearning,
  pgnMatchesLearningFilter,
  sortLearningPgns,
  type OpeningLearningFilter,
  type OpeningPgnMasteryView,
} from '@/lib/repertoire';
import { openingMasteryStore } from '@/lib/repertoire';

export type LearningPgnListItem = OpeningPgnMasteryView & {
  file: StoredPgnFile;
  folder: RepertoireFolder | null;
  sortName: string;
  id: string;
  masteryRatio: number;
};

export function useLearningPgnList(
  folders: readonly RepertoireFolder[],
  files: readonly StoredPgnFile[],
  masteryTick: number,
) {
  const [filter, setFilter] = useState<OpeningLearningFilter>('all');

  const items = useMemo(() => {
    void masteryTick;
    const byFolder = new Map(folders.map((f) => [f.id, f]));
    const rows: LearningPgnListItem[] = files.filter(isFileVisibleInLearning).map((file) => {
      const view = describeOpeningPgnMastery(file, openingMasteryStore);
      return {
        ...view,
        file,
        folder: byFolder.get(file.folderId) ?? null,
        sortName: view.displayName,
        id: file.id,
        masteryRatio: view.ratio,
      };
    });
    return sortLearningPgns(rows);
  }, [files, folders, masteryTick]);

  const counts = useMemo(() => {
    const all = items.length;
    let unmastered = 0;
    let partial = 0;
    let mastered = 0;
    let priority = 0;
    for (const item of items) {
      if (item.category === 'unmastered') unmastered += 1;
      else if (item.category === 'partial') partial += 1;
      else mastered += 1;
      if (item.priority) priority += 1;
    }
    return { unmastered, partial, mastered, priority, all };
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter((item) =>
        pgnMatchesLearningFilter(item.category, item.priority, filter),
      ),
    [filter, items],
  );

  return { filter, setFilter, items, visible, counts };
}
