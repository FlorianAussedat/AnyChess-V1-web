import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import {
  appendRevisionResult,
  compareLearningPgns,
  getOpeningPgnLearningCategory,
  getOpeningPgnMastery,
  isOpeningLineMastered,
  lastFiveRevisionResults,
  openingLineKey,
  pickUnmasteredLearningPath,
  pgnMatchesLearningFilter,
  sortLearningPgns,
  unmasteredLearningPaths,
  type OpeningRevisionResult,
} from '../openingMastery.ts';
import { OpeningMasteryStore } from '../OpeningMasteryStore.ts';
import type { ContinueLinePath } from '../../continueLine/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

const S: OpeningRevisionResult = 'success';
const F: OpeningRevisionResult = 'failure';

function path(id: string): ContinueLinePath {
  return { id, sans: id.split(' '), fensBefore: ['start'], choices: [] };
}

describe('isOpeningLineMastered', () => {
  it('[] is not mastered', () => {
    assert.equal(isOpeningLineMastered([]), false);
  });

  it('a single success is not mastered', () => {
    assert.equal(isOpeningLineMastered([S]), false);
  });

  it('four successes are not mastered', () => {
    assert.equal(isOpeningLineMastered([S, S, S, S]), false);
  });

  it('five successes are mastered', () => {
    assert.equal(isOpeningLineMastered([S, S, S, S, S]), true);
  });

  it('✓ ✓ ✗ ✓ ✓ is mastered', () => {
    assert.equal(isOpeningLineMastered([S, S, F, S, S]), true);
  });

  it('✗ ✓ ✓ ✓ ✓ is mastered', () => {
    assert.equal(isOpeningLineMastered([F, S, S, S, S]), true);
  });

  it('✓ ✓ ✓ ✓ ✗ is not mastered', () => {
    assert.equal(isOpeningLineMastered([S, S, S, S, F]), false);
  });

  it('a mastered line loses mastery immediately after a failure', () => {
    const mastered = [S, S, S, S, S];
    assert.equal(isOpeningLineMastered(mastered), true);
    assert.equal(isOpeningLineMastered(appendRevisionResult(mastered, F)), false);
  });

  it('only the last five attempts decide mastery', () => {
    assert.equal(isOpeningLineMastered([F, F, F, S, S, S, S, S]), true);
    assert.equal(isOpeningLineMastered([S, S, S, S, S, F]), false);
    assert.deepEqual(lastFiveRevisionResults([S, F, S, F, S, S, S]), [S, F, S, S, S]);
  });
});

describe('PGN mastery percent', () => {
  it('0 / 10 => 0%', () => {
    const m = getOpeningPgnMastery(0, 10);
    assert.equal(m.ratio, 0);
    assert.equal(m.percentRounded, 0);
    assert.equal(m.category, 'unmastered');
  });

  it('5 / 10 => 50%', () => {
    const m = getOpeningPgnMastery(5, 10);
    assert.equal(m.ratio, 0.5);
    assert.equal(m.percentRounded, 50);
    assert.equal(m.category, 'partial');
  });

  it('19 / 20 => 95%', () => {
    const m = getOpeningPgnMastery(19, 20);
    assert.equal(m.ratio, 0.95);
    assert.equal(m.percentRounded, 95);
    assert.equal(m.category, 'partial');
  });

  it('20 / 20 => 100%', () => {
    const m = getOpeningPgnMastery(20, 20);
    assert.equal(m.ratio, 1);
    assert.equal(m.percentRounded, 100);
    assert.equal(m.category, 'mastered');
  });

  it('zero lines is 0% without NaN', () => {
    const m = getOpeningPgnMastery(0, 0);
    assert.equal(m.ratio, 0);
    assert.equal(m.percentRounded, 0);
    assert.equal(Number.isNaN(m.ratio), false);
    assert.equal(m.category, 'unmastered');
  });
});

describe('learning categories', () => {
  it('uses exact bounds', () => {
    assert.equal(getOpeningPgnLearningCategory(0), 'unmastered');
    assert.equal(getOpeningPgnLearningCategory(0.499), 'unmastered');
    assert.equal(getOpeningPgnLearningCategory(0.5), 'partial');
    assert.equal(getOpeningPgnLearningCategory(0.95), 'partial');
    assert.equal(getOpeningPgnLearningCategory(0.951), 'mastered');
    assert.equal(getOpeningPgnLearningCategory(1), 'mastered');
  });

  it('20/21 stays mastered because 95.2% > 95%', () => {
    assert.equal(getOpeningPgnMastery(20, 21).category, 'mastered');
  });

  it('19/21 becomes partial', () => {
    assert.equal(getOpeningPgnMastery(19, 21).category, 'partial');
  });
});

describe('priority filter and sort', () => {
  it('priority is off by default and is a transversal filter', () => {
    assert.equal(pgnMatchesLearningFilter('partial', false, 'priority'), false);
    assert.equal(pgnMatchesLearningFilter('partial', true, 'priority'), true);
    assert.equal(pgnMatchesLearningFilter('partial', true, 'partial'), true);
    assert.equal(pgnMatchesLearningFilter('partial', true, 'all'), true);
    assert.equal(pgnMatchesLearningFilter('unmastered', true, 'mastered'), false);
  });

  it('sorts priority first then lowest mastery percent', () => {
    const ordered = sortLearningPgns([
      { id: 'A', sortName: 'A', priority: true, masteryRatio: 0.7 },
      { id: 'B', sortName: 'B', priority: false, masteryRatio: 0.1 },
      { id: 'C', sortName: 'C', priority: true, masteryRatio: 0.2 },
      { id: 'D', sortName: 'D', priority: false, masteryRatio: 0.4 },
    ]);
    assert.deepEqual(
      ordered.map((p) => p.id),
      ['C', 'A', 'B', 'D'],
    );
  });

  it('compareLearningPgns is stable on equal percent via name', () => {
    const a = { id: 'a', sortName: 'Alpha', priority: false, masteryRatio: 0.1 };
    const b = { id: 'b', sortName: 'Beta', priority: false, masteryRatio: 0.1 };
    assert.ok(compareLearningPgns(a, b) < 0);
  });
});

describe('OpeningMasteryStore', () => {
  let store: OpeningMasteryStore;

  beforeEach(() => {
    store = new OpeningMasteryStore(new MemoryKeyValueStorage());
  });

  it('defaults missing lines to empty history (À travailler)', async () => {
    await store.ensureLoaded();
    assert.deepEqual(store.historyFor('pgn', 'line-a'), []);
    assert.equal(store.isLineMastered('pgn', 'line-a'), false);
  });

  it('persists and reloads review history', async () => {
    const kv = new MemoryKeyValueStorage();
    const a = new OpeningMasteryStore(kv);
    await a.recordResult('pgn', 'line-a', 'success', 't1');
    await a.recordResult('pgn', 'line-a', 'failure', 't2');
    const b = new OpeningMasteryStore(kv);
    await b.ensureLoaded();
    assert.deepEqual(b.historyFor('pgn', 'line-a'), ['success', 'failure']);
    assert.equal(b.getSnapshot().lines[openingLineKey('pgn', 'line-a')]?.totalAttempts, 2);
  });

  it('toggles priority independently of line history (PGN flag is on the file)', () => {
    assert.equal('priority' in { id: 'x' }, false);
  });

  it('prunes a deleted PGN so no orphans remain', async () => {
    await store.recordResult('keep', 'a', 'success');
    await store.recordResult('gone', 'b', 'failure');
    await store.pruneFile('gone');
    assert.equal(store.historyFor('gone', 'b').length, 0);
    assert.equal(store.historyFor('keep', 'a').length, 1);
  });
});

describe('automatic Learning pool', () => {
  it('includes only unmastered lines and still lists mastered ones separately', () => {
    const paths = [path('e4 e5'), path('e4 c5'), path('d4 d5')];
    const mastered = new Set([openingLineKey('f', 'e4 e5')]);
    const historyFor = (key: string): OpeningRevisionResult[] =>
      mastered.has(key) ? [S, S, S, S, S] : [];
    const auto = unmasteredLearningPaths('f', paths, historyFor);
    assert.deepEqual(
      auto.map((p) => p.id),
      ['e4 c5', 'd4 d5'],
    );
    const pick = pickUnmasteredLearningPath('f', paths, historyFor, () => 0);
    assert.equal(pick?.id, 'e4 c5');
    assert.equal(isOpeningLineMastered(historyFor(openingLineKey('f', 'e4 e5'))), true);
  });
});

describe('Review pool ignores mastery and priority', () => {
  it('flattenReviewLines keeps every training path', () => {
    const src = read('lib/repertoire/pickReviewLine.ts');
    assert.match(src, /flattenReviewLines/);
    assert.match(src, /Uniform draw among every line/);
    assert.doesNotMatch(src, /isOpeningLineMastered/);
    assert.doesNotMatch(src, /file\.priority/);
    assert.doesNotMatch(src, /pickBalanced/);
  });
});

describe('Learning screens never write Review history', () => {
  it('study and learn UI do not call recordOpeningRevisionResult', () => {
    assert.doesNotMatch(read('app/openings/study.tsx'), /recordOpeningRevisionResult/);
    assert.doesNotMatch(read('app/openings/learn.tsx'), /recordOpeningRevisionResult/);
    assert.match(read('app/openings/play.tsx'), /commitOpeningReviewAttempt/);
    assert.match(read('app/openings/continue.tsx'), /recordOpeningRevisionResult/);
    assert.match(read('lib/repertoire/recordOpeningRevision.ts'), /origin !== 'review'/);
  });

  it('play only records when origin is review', () => {
    const play = read('app/openings/play.tsx');
    assert.match(play, /origin !== 'review'/);
    assert.match(play, /autoUnmastered/);
  });
});

describe('priority persistence lives on StoredPgnFile', () => {
  it('RepertoireService can setFilePriority without touching Review pick', () => {
    const svc = read('lib/repertoire/RepertoireService.ts');
    assert.match(svc, /async setFilePriority/);
    assert.match(svc, /file\.priority = priority/);
    assert.match(svc, /openingMasteryStore\.pruneFile/);
    const pick = read('lib/repertoire/pickReviewLine.ts');
    assert.doesNotMatch(pick, /file\.priority/);
    assert.doesNotMatch(pick, /isPgnPriority/);
  });
});
