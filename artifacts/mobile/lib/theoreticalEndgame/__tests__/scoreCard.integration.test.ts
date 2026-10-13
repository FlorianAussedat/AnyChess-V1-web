/**
 * A real win goes through the store and the post-game grader, then the theme card.
 * Remount and a cold cache read the same persisted score. This is not an evaluator-only test.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import React from 'react';
import { getPositionById } from '../selection/selectors.ts';
import { replayUserDecisions } from '../analysis/decisionPath.ts';
import { QUALITY_TRAJECTORIES, RECORDED_START_FEN } from '../analysis/qualityTrajectories.ts';
import { backfillUngradedWins, runPostGameGrade } from '../analysis/postGameGrade.ts';
import { resetGradeGate } from '../analysis/gradeGate.ts';
import { formatComprehensionScore } from '../domain/comprehensionScore.ts';
import type { DefenseAnalyzer } from '../../defendDraw/defenseTypes.ts';
import type { TheoreticalAttemptResult, TheoreticalThemeId } from '../domain/types.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import {
  clearTheoreticalStoreCache,
  configureTheoreticalStoreStorage,
  getAllThemeScores,
  getThemeAttempts,
  recordAttempt,
  updateAttemptGrade,
} from '../persistence/TheoreticalEndgameStore.ts';
import {
  EMPTY_THEME_SCORE,
  TheoreticalThemeScoreLine,
} from '../ui/TheoreticalThemeScoreLine.tsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Tree = {
  type?: string;
  props?: { testID?: string; onPress?: () => void };
  children?: Array<Tree | string> | null;
};

function walk(node: Tree | string | Array<Tree | string> | null | undefined, visit: (node: Tree) => void): void {
  if (node == null || typeof node === 'string') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  visit(node);
  const children = node.children;
  if (typeof children === 'string') return;
  if (Array.isArray(children)) {
    for (const child of children) walk(child as Tree, visit);
  }
}

function textsOf(node: Tree | Tree[] | null): string[] {
  const out: string[] = [];
  walk(node, (item) => {
    const children = item.children as Array<Tree | string> | string | null | undefined;
    if (typeof children === 'string') out.push(children);
    else if (Array.isArray(children)) {
      for (const child of children) {
        if (typeof child === 'string') out.push(child);
      }
    }
  });
  return out;
}

function findByTestId(node: Tree | Tree[] | null, testID: string): Tree | null {
  let found: Tree | null = null;
  walk(node, (item) => {
    if (item.props?.testID === testID) found = item;
  });
  return found;
}

const { create, act } = await import('react-test-renderer');

const noMate: DefenseAnalyzer = {
  async analyze() {
    return { scoreCp: 80, mateIn: null, depth: 8, wdl: { win: 900, draw: 50, loss: 50 }, bestMove: null };
  },
};

function line(id: string) {
  const row = QUALITY_TRAJECTORIES.find((item) => item.id === id);
  if (!row) throw new Error(id);
  const startFen = RECORDED_START_FEN[row.positionId] ?? getPositionById(row.positionId)?.initialFen;
  if (!startFen) throw new Error(`fen ${row.positionId}`);
  return { ...row, startFen };
}

function storedWin(
  id: string,
  themeId: TheoreticalThemeId,
  finishedAt: string,
): TheoreticalAttemptResult {
  const row = line(id);
  const decisions = replayUserDecisions(row.startFen, 'white', row.sans);
  return {
    outcome: 'success',
    positionId: row.positionId,
    themeId,
    objective: 'WIN',
    objectiveKind: themeId === 'opposition' ? 'win' : 'mate',
    playerColor: 'white',
    userMoves: decisions.length,
    scoreScale: 'quality-5',
    attemptScore: null,
    quality: null,
    durationMs: 4000,
    firstTheoreticalLoss: null,
    startFen: row.startFen,
    endFen: decisions.at(-1)?.fenAfter ?? row.startFen,
    moveSans: row.sans,
    finishedAt,
    offScore: false,
    analysisStatus: 'pending',
    gradeConfidence: null,
  };
}

function Cards({
  scores,
  onRecalculate,
}: {
  scores: Awaited<ReturnType<typeof getAllThemeScores>>;
  onRecalculate?: (themeId: string) => void;
}) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(TheoreticalThemeScoreLine, {
      themeId: 'two-bishops-mate',
      summary: scores['two-bishops-mate'] ?? EMPTY_THEME_SCORE,
      onRecalculate: () => onRecalculate?.('two-bishops-mate'),
    }),
    React.createElement(TheoreticalThemeScoreLine, {
      themeId: 'opposition',
      summary: scores.opposition ?? EMPTY_THEME_SCORE,
      onRecalculate: () => onRecalculate?.('opposition'),
    }),
  );
}

async function mountCards(): Promise<{
  renderer: ReturnType<typeof create>;
  json: () => Tree;
}> {
  const scores = await getAllThemeScores();
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(React.createElement(Cards, { scores }));
  });
  return { renderer, json: () => renderer.toJSON() as Tree };
}

describe('theoretical score cards', { concurrency: 1 }, () => {
  let storage: MemoryKeyValueStorage;

  beforeEach(() => {
    storage = new MemoryKeyValueStorage();
    configureTheoreticalStoreStorage(storage);
    clearTheoreticalStoreCache();
    resetGradeGate();
  });

  it('persists a two-bishops win and an opposition win on the cards after remount and restart', async () => {
    await recordAttempt(storedWin('two-bishops-short-efficient', 'two-bishops-mate', '2026-10-13T10:00:00.000Z'));
    await recordAttempt(storedWin('opposition-catalog-1', 'opposition', '2026-10-13T10:05:00.000Z'));
    assert.equal((await getThemeAttempts('two-bishops-mate')).length, 1);
    assert.equal((await getThemeAttempts('opposition')).length, 1);

    const bishops = await runPostGameGrade({
      themeId: 'two-bishops-mate',
      positionId: 'TE-ENGINE-BISHOPS',
      finishedAt: '2026-10-13T10:00:00.000Z',
      analyzer: noMate,
      deadlineMs: 30_000,
    });
    const opposition = await runPostGameGrade({
      themeId: 'opposition',
      positionId: 'TE-CANON-OPPOSITION',
      finishedAt: '2026-10-13T10:05:00.000Z',
      analyzer: noMate,
    });
    assert.equal(typeof bishops?.attemptScore, 'number');
    assert.equal(typeof opposition?.attemptScore, 'number');
    assert.equal((await getThemeAttempts('two-bishops-mate')).length, 1);
    assert.equal((await getThemeAttempts('opposition')).length, 1);

    const first = await mountCards();
    const firstText = textsOf(first.json());
    const shows = (score: number) => firstText.some((item) => item.includes(formatComprehensionScore(score)));
    assert.equal(shows(bishops!.attemptScore!), true);
    assert.equal(shows(opposition!.attemptScore!), true);
    const oppositionScore = textsOf(findByTestId(first.json(), 'theoretical-theme-score-opposition'));
    assert.deepEqual(oppositionScore, [formatComprehensionScore(opposition!.attemptScore!)]);
    first.renderer.unmount();

    const remounted = await mountCards();
    const remountedText = textsOf(remounted.json());
    assert.equal(remountedText.some((item) => item.includes(formatComprehensionScore(opposition!.attemptScore!))), true);
    assert.equal(remountedText.some((item) => item.includes(formatComprehensionScore(bishops!.attemptScore!))), true);
    remounted.renderer.unmount();

    clearTheoreticalStoreCache();
    const restarted = await mountCards();
    const again = textsOf(restarted.json());
    assert.equal(again.some((item) => item.includes(formatComprehensionScore(bishops!.attemptScore!))), true);
    assert.equal(again.some((item) => item.includes(formatComprehensionScore(opposition!.attemptScore!))), true);
    assert.equal((await getThemeAttempts('two-bishops-mate')).length, 1);
    assert.equal((await getThemeAttempts('opposition')).length, 1);
    restarted.renderer.unmount();
  });

  it('backfills a failed win from its saved moves without a second attempt', async () => {
    await recordAttempt(storedWin('two-bishops-short-efficient', 'two-bishops-mate', '2026-10-13T11:00:00.000Z'));
    await recordAttempt(storedWin('opposition-catalog-1', 'opposition', '2026-10-13T11:05:00.000Z'));
    await updateAttemptGrade('two-bishops-mate', 'TE-ENGINE-BISHOPS', '2026-10-13T11:00:00.000Z', {
      analysisStatus: 'failed',
      gradeCause: 'engine-no-mate',
      attemptScore: null,
      gradeConfidence: null,
    });
    await updateAttemptGrade('opposition', 'TE-CANON-OPPOSITION', '2026-10-13T11:05:00.000Z', {
      analysisStatus: 'failed',
      gradeCause: 'engine-no-mate',
      attemptScore: null,
      gradeConfidence: null,
    });

    const filled = await backfillUngradedWins();
    assert.equal(filled.rescored, 2);
    assert.equal(filled.missingTrajectory, 0);
    const bishops = (await getThemeAttempts('two-bishops-mate'))[0]!;
    const opposition = (await getThemeAttempts('opposition'))[0]!;
    assert.equal(typeof bishops.attemptScore, 'number');
    assert.equal(typeof opposition.attemptScore, 'number');
    assert.equal((await getThemeAttempts('two-bishops-mate')).length, 1);
    assert.equal((await getThemeAttempts('opposition')).length, 1);

    const again = await backfillUngradedWins();
    assert.equal(again.rescored, 0);
    assert.equal((await getThemeAttempts('two-bishops-mate')).length, 1);

    clearTheoreticalStoreCache();
    const view = await mountCards();
    const text = textsOf(view.json());
    assert.equal(text.some((item) => item.includes(formatComprehensionScore(bishops.attemptScore!))), true);
    assert.equal(text.some((item) => item.includes(formatComprehensionScore(opposition.attemptScore!))), true);
    assert.equal(text.includes('Recalculer la note'), false);
    view.renderer.unmount();
  });

  it('keeps a win without moves unscored and offers a retry', async () => {
    const win = storedWin('opposition-catalog-1', 'opposition', '2026-10-13T12:00:00.000Z');
    win.moveSans = [];
    await recordAttempt(win);
    const filled = await backfillUngradedWins();
    assert.equal(filled.rescored, 0);
    assert.equal(filled.missingTrajectory, 1);
    const stored = (await getThemeAttempts('opposition'))[0]!;
    assert.equal(stored.attemptScore, null);
    assert.equal(stored.analysisStatus, 'failed');
    assert.equal(stored.gradeCause, 'no-trajectory');
    assert.equal((await getThemeAttempts('opposition')).length, 1);

    const view = await mountCards();
    const text = textsOf(view.json());
    assert.ok(text.includes('—/5'));
    assert.ok(text.includes('Recalculer la note'));
    assert.equal(text.includes('Note en cours…'), false);
    view.renderer.unmount();
  });

  it('shows an in-progress grade instead of a bare dash', async () => {
    await recordAttempt(storedWin('opposition-catalog-1', 'opposition', '2026-10-13T13:00:00.000Z'));
    const summary = await getAllThemeScores();
    assert.equal(summary.opposition?.pendingCount, 1);
    assert.equal(summary.opposition?.count, 0);
    const view = await mountCards();
    const text = textsOf(view.json());
    assert.ok(text.includes('Note en cours…'));
    assert.equal(text.filter((item) => item === '—/5').includes('—/5'), true);
    const opposition = textsOf(findByTestId(view.json(), 'theoretical-theme-score-opposition'));
    assert.deepEqual(opposition, ['Note en cours…']);
    view.renderer.unmount();
  });
});
