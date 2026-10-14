/**
 * One visible /5 grade, the reset dialog, and races against a late analysis
 * or an older cloud document. These cases drive the real store and the dialog.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import React from 'react';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { backfillUngradedWins, runPostGameGrade } from '../analysis/postGameGrade.ts';
import { resetGradeGate } from '../analysis/gradeGate.ts';
import { formatComprehensionScore, headlineFor } from '../domain/comprehensionScore.ts';
import type { TheoreticalAttemptResult } from '../domain/types.ts';
import type { DefenseAnalysis } from '../../defendDraw/defenseTypes.ts';
import {
  clearTheoreticalStoreCache,
  configureTheoreticalStoreStorage,
  getCatalogView,
  getThemeAttempts,
  getThemeComprehension,
  loadTheoreticalStore,
  mergeTheoreticalDocuments,
  recordAttempt,
  resetAllTheoreticalScores,
  setCatalogView,
} from '../persistence/TheoreticalEndgameStore.ts';
import { TheoreticalAttemptNote } from '../ui/TheoreticalAttemptNote.tsx';
import { TheoreticalScoreReset } from '../ui/TheoreticalScoreReset.tsx';
import {
  EMPTY_THEME_SCORE,
  TheoreticalThemeScoreLine,
} from '../ui/TheoreticalThemeScoreLine.tsx';
import { AppDialogHost } from '@/components/ui/AppDialogHost';
import { __resetAppDialogStoreForTests } from '@/lib/ui/appDialogStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Tree = {
  type?: string;
  props?: { testID?: string; onPress?: () => void; onRequestClose?: () => void };
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

function findByType(node: Tree | Tree[] | null, type: string): Tree | null {
  let found: Tree | null = null;
  walk(node, (item) => {
    if (item.type === type) found = item;
  });
  return found;
}

const { create, act } = await import('react-test-renderer');

function attempt(score: number | null, finishedAt: string, theme: 'queen-mate' | 'opposition' = 'queen-mate'): TheoreticalAttemptResult {
  return {
    outcome: score === 0 ? 'theoretical-loss' : 'success',
    positionId: theme === 'opposition' ? 'TE-CANON-OPPOSITION' : 'TE-CANON-QUEEN-MATE',
    themeId: theme,
    objective: 'WIN',
    objectiveKind: 'mate',
    playerColor: 'white',
    userMoves: 1,
    scoreScale: 'quality-5',
    attemptScore: score,
    quality: null,
    durationMs: 1000,
    firstTheoreticalLoss: null,
    startFen: '7k/6Q1/6K1/8/8/8/8/8 w - - 0 1',
    endFen: '7k/6Q1/6K1/8/8/8/8/8 w - - 0 1',
    moveSans: ['Qh7'],
    finishedAt,
    offScore: false,
    analysisStatus: score == null ? 'pending' : 'scored',
    gradeConfidence: score == null ? null : 'exact',
  };
}

describe('theoretical score display and reset', { concurrency: 1 }, () => {
  let storage: MemoryKeyValueStorage;

  beforeEach(() => {
    storage = new MemoryKeyValueStorage();
    configureTheoreticalStoreStorage(storage);
    clearTheoreticalStoreCache();
    resetGradeGate();
    __resetAppDialogStoreForTests();
  });

  async function renderBoard(note?: { score: number | null; outcome: 'success' | 'theoretical-loss'; pending?: boolean }): Promise<ReturnType<typeof create>> {
    const summary = await getThemeComprehension('queen-mate');
    const opposition = await getThemeComprehension('opposition');
    const shown = note ?? { score: null, outcome: 'success' as const, pending: false };
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        React.createElement(
          'View',
          null,
          React.createElement(TheoreticalThemeScoreLine, {
            themeId: 'queen-mate',
            summary: summary ?? EMPTY_THEME_SCORE,
          }),
          React.createElement(TheoreticalThemeScoreLine, {
            themeId: 'opposition',
            summary: opposition ?? EMPTY_THEME_SCORE,
          }),
          React.createElement(TheoreticalAttemptNote, {
            score: shown.score,
            pending: shown.pending === true,
          }),
          React.createElement(
            'Text',
            { testID: 'theoretical-result-title' },
            headlineFor({
              score: shown.score,
              outcome: shown.outcome,
              objective: 'WIN',
              lang: 'fr',
            }),
          ),
          React.createElement(TheoreticalScoreReset, {
            themeId: 'queen-mate',
            themeTitle: 'Dame et roi contre roi',
            showTheme: true,
            showAll: true,
          }),
          React.createElement(AppDialogHost, null),
        ),
      );
    });
    return renderer;
  }

  it('shows one note and one average, with no estimated or legacy label', async () => {
    const notes = [5, 4, 3, 2, 0];
    for (let index = 0; index < notes.length; index += 1) {
      const score = notes[index]!;
      await recordAttempt(
        attempt(score, `2026-10-14T12:0${index}:00.000Z`),
      );
      if (index % 2 === 1) {
        const { updateAttemptGrade } = await import('../persistence/TheoreticalEndgameStore.ts');
        await updateAttemptGrade('queen-mate', 'TE-CANON-QUEEN-MATE', `2026-10-14T12:0${index}:00.000Z`, {
          attemptScore: score,
          gradeConfidence: 'estimated',
          analysisStatus: 'estimated',
        });
      }
    }
    await recordAttempt(attempt(null, '2026-10-14T12:06:00.000Z'));
    await recordAttempt(
      attempt(8, '2026-01-01T00:00:00.000Z'),
    );
    const legacy = await getThemeAttempts('queen-mate');
    const old = legacy.find((row) => row.finishedAt.startsWith('2026-01-01'));
    if (old) {
      old.scoreScale = 'legacy-10';
      await storage.setItem('anychess.theoreticalEndgame.v2', JSON.stringify(await loadTheoreticalStore()));
      clearTheoreticalStoreCache();
    }

    const summary = await getThemeComprehension('queen-mate');
    assert.equal(summary.score, 2.8);
    assert.equal(summary.count, 5);
    assert.equal(summary.attemptCount, 6);
    assert.equal(summary.pendingCount, 1);
    assert.equal(summary.winCount, 5);

    const view = await renderBoard({ score: 0, outcome: 'theoretical-loss' });
    const text = textsOf(view.toJSON() as Tree);
    assert.ok(text.includes(`Moyenne : ${formatComprehensionScore(2.8)}`));
    assert.ok(text.includes('Note : 0/5'));
    assert.ok(text.includes('Objectif échoué'));
    assert.ok(text.includes('Note en cours…'));
    assert.equal(text.some((item) => item.includes('Note estimée')), false);
    assert.equal(text.some((item) => item.includes('Estimated')), false);
    assert.equal(text.some((item) => item.includes('Ancien barème')), false);
    assert.equal(text.some((item) => item.includes('/10')), false);
    assert.equal(text.filter((item) => item.startsWith('Moyenne :')).length, 1);
    view.unmount();
  });

  it('cancel and Android back leave the theme unchanged, confirm clears only that theme', async () => {
    await storage.setItem('anychess.saved-pgn', 'game');
    await setCatalogView('list');
    await recordAttempt(attempt(5, '2026-10-14T08:00:00.000Z'));
    await recordAttempt(attempt(4, '2026-10-14T08:05:00.000Z', 'opposition'));
    const view = await renderBoard();

    await act(async () => {
      findByTestId(view.toJSON() as Tree, 'theoretical-reset-theme-queen-mate')?.props?.onPress?.();
    });
    const open = textsOf(view.toJSON() as Tree);
    assert.ok(open.includes('Réinitialiser ce thème ?'));
    assert.ok(open.some((item) => item.includes('notes') && item.includes('records') && item.includes('tentatives')));

    await act(async () => {
      findByTestId(view.toJSON() as Tree, 'app-dialog-cancel')?.props?.onPress?.();
    });
    assert.equal((await getThemeAttempts('queen-mate')).length, 1);
    assert.equal((await getThemeComprehension('queen-mate')).score, 5);

    await act(async () => {
      findByTestId(view.toJSON() as Tree, 'theoretical-reset-theme-queen-mate')?.props?.onPress?.();
    });
    await act(async () => {
      findByType(view.toJSON() as Tree, 'Modal')?.props?.onRequestClose?.();
    });
    assert.equal((await getThemeAttempts('queen-mate')).length, 1);
    assert.equal(await storage.getItem('anychess.saved-pgn'), 'game');

    await act(async () => {
      findByTestId(view.toJSON() as Tree, 'theoretical-reset-theme-queen-mate')?.props?.onPress?.();
    });
    await act(async () => {
      findByTestId(view.toJSON() as Tree, 'app-dialog-confirm')?.props?.onPress?.();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal((await getThemeAttempts('queen-mate')).length, 0);
    assert.equal((await getThemeComprehension('queen-mate')).count, 0);
    assert.equal((await getThemeComprehension('opposition')).score, 4);
    assert.equal(await getCatalogView(), 'list');
    assert.equal(await storage.getItem('anychess.saved-pgn'), 'game');
    view.unmount();
  });

  it('confirming the global reset clears every theoretical theme and nothing else', async () => {
    await storage.setItem('anychess.openings', 'kept');
    await recordAttempt(attempt(5, '2026-10-14T08:00:00.000Z'));
    await recordAttempt(attempt(4, '2026-10-14T08:05:00.000Z', 'opposition'));
    const view = await renderBoard();
    await act(async () => {
      findByTestId(view.toJSON() as Tree, 'theoretical-reset-all')?.props?.onPress?.();
    });
    const open = textsOf(view.toJSON() as Tree);
    assert.ok(open.some((item) => item.includes('toutes les finales théoriques') && item.includes('ouvertures')));
    await act(async () => {
      findByTestId(view.toJSON() as Tree, 'app-dialog-confirm')?.props?.onPress?.();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal((await getThemeAttempts('queen-mate')).length, 0);
    assert.equal((await getThemeAttempts('opposition')).length, 0);
    assert.equal(await storage.getItem('anychess.openings'), 'kept');
    view.unmount();
  });

  it('a grade that finishes after the reset is not written back, and backfill does not revive it', async () => {
    const finishedAt = '2026-10-12T12:00:00.000Z';
    await recordAttempt(attempt(null, finishedAt));
    const snapshot = JSON.parse(JSON.stringify(await loadTheoreticalStore())) as unknown;
    let release!: (value: DefenseAnalysis) => void;
    const gate = new Promise<DefenseAnalysis>((resolve) => {
      release = resolve;
    });
    let markEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    const job = runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-CANON-QUEEN-MATE',
      finishedAt,
      deadlineMs: 30_000,
      mateDriveFallback: false,
      analyzer: {
        async analyze() {
          markEntered();
          return gate;
        },
      },
    });
    await entered;
    await resetAllTheoreticalScores('2026-10-14T09:00:00.000Z');
    release({
      scoreCp: 0,
      mateIn: 1,
      depth: 12,
      wdl: { win: 900, draw: 50, loss: 50 },
      bestMove: null,
    });
    assert.equal(await job, null);
    assert.equal((await getThemeAttempts('queen-mate')).length, 0);

    const filled = await backfillUngradedWins();
    assert.equal(filled.rescored, 0);
    const merged = mergeTheoreticalDocuments(await loadTheoreticalStore(), snapshot);
    await storage.setItem('anychess.theoreticalEndgame.v2', JSON.stringify(merged));
    clearTheoreticalStoreCache();
    const revived = await backfillUngradedWins();
    assert.equal(revived.rescored, 0);
    assert.equal((await getThemeAttempts('queen-mate')).length, 0);

    await recordAttempt(attempt(null, '2026-10-14T11:00:00.000Z'));
    const after = await backfillUngradedWins();
    const stored = await getThemeAttempts('queen-mate');
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.finishedAt, '2026-10-14T11:00:00.000Z');
    assert.equal(stored[0]?.finishedAt === finishedAt, false);
    const summary = await getThemeComprehension('queen-mate');
    assert.equal(summary.attemptCount, 1);
    assert.equal(after.rescored <= 1, true);
  });
});
