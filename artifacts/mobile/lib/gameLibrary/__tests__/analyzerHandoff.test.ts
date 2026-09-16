/**
 * Non-regression: finished real games hand off to /parties/analyzer.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { GameLibraryStore } from '../GameLibraryStore.ts';
import {
  buildAnalyzerHref,
  openPgnInAnalyzer,
} from '../openPgnInAnalyzer.ts';
import {
  getEndgameAnalysisOverlay,
  openEndgameInReader,
} from '../../endgameTraining/review/EndgameAnalysisAdapter.ts';
import {
  getTheoreticalAnalysisOverlay,
  openTheoreticalInReader,
} from '../../theoreticalEndgame/review/TheoreticalAnalysisAdapter.ts';
import type { AttemptResult } from '../../endgameTraining/domain/types.ts';
import type { TheoreticalAttemptResult } from '../../theoreticalEndgame/domain/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

const SAMPLE_PGN = `[Event "Test"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0
`;

describe('buildAnalyzerHref', () => {
  it('targets /parties/analyzer with gameId and optional params', () => {
    const href = buildAnalyzerHref('g1', {
      flipped: true,
      tab: 'analysis',
      nodeId: 'n1',
    });
    assert.equal(href.pathname, '/parties/analyzer');
    assert.deepEqual(href.params, {
      gameId: 'g1',
      tab: 'analysis',
      flipped: '1',
      nodeId: 'n1',
    });
  });
});

describe('openPgnInAnalyzer', () => {
  it('imports PGN then returns analyzer href', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const opened = await openPgnInAnalyzer({
      pgnText: SAMPLE_PGN,
      fileName: 'test.pgn',
      displayName: 'Ma partie',
      flipped: true,
      store,
    });
    assert.ok(opened);
    assert.equal(opened!.href.pathname, '/parties/analyzer');
    assert.equal(opened!.href.params.gameId, opened!.gameId);
    assert.equal(opened!.href.params.tab, 'analysis');
    assert.equal(opened!.href.params.flipped, '1');
    const snap = await store.getSnapshot();
    assert.equal(snap.games.length, 1);
    assert.equal(snap.games[0]!.id, opened!.gameId);
    assert.equal(snap.games[0]!.displayName, 'Ma partie');
  });

  it('reuses existing library game on duplicate fingerprint', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const first = await openPgnInAnalyzer({
      pgnText: SAMPLE_PGN,
      fileName: 'a.pgn',
      store,
    });
    const second = await openPgnInAnalyzer({
      pgnText: SAMPLE_PGN,
      fileName: 'b.pgn',
      store,
    });
    assert.ok(first && second);
    assert.equal(first!.gameId, second!.gameId);
    const snap = await store.getSnapshot();
    assert.equal(snap.games.length, 1);
  });
});

describe('endgame / theoretical adapters', () => {
  it('openEndgameInReader saves + pushes analyzer href with overlay', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const pushed: unknown[] = [];
    const result: AttemptResult = {
      outcome: 'win-official-draw',
      movesResisted: 2,
      timeline: [],
      moveSans: ['Ke2', 'Ke7'],
      startFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      endFen: '4k3/8/8/8/8/8/4K3/8 b - - 1 1',
      positionId: 'eg-1',
      finishedAt: new Date().toISOString(),
    };
    const id = await openEndgameInReader({
      result,
      defender: 'white',
      store,
      routerPush: (href) => {
        pushed.push(href);
      },
    });
    assert.ok(id);
    assert.equal(pushed.length, 1);
    const href = pushed[0] as { pathname: string; params: Record<string, string> };
    assert.equal(href.pathname, '/parties/analyzer');
    assert.equal(href.params.gameId, id);
    assert.equal(href.params.tab, 'analysis');
    assert.ok(getEndgameAnalysisOverlay(id!));
  });

  it('openTheoreticalInReader saves + pushes analyzer href with overlay', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const pushed: unknown[] = [];
    const result: TheoreticalAttemptResult = {
      outcome: 'success',
      positionId: 'th-1',
      themeId: 'opposition',
      objective: 'WIN',
      playerColor: 'black',
      userMoves: 3,
      targetUserMoves: 5,
      attemptScore: 8,
      firstTheoreticalLoss: null,
      startFen: '4k3/8/8/8/8/8/4K3/4Q3 b - - 0 1',
      endFen: '4k3/8/8/8/8/8/4K3/4Q3 w - - 1 2',
      moveSans: ['Ke7'],
      finishedAt: new Date().toISOString(),
      offScore: false,
    };
    const id = await openTheoreticalInReader({
      result,
      store,
      routerPush: (href) => {
        pushed.push(href);
      },
    });
    assert.ok(id);
    const href = pushed[0] as { pathname: string; params: Record<string, string> };
    assert.equal(href.pathname, '/parties/analyzer');
    assert.equal(href.params.flipped, '1');
    assert.ok(getTheoreticalAnalysisOverlay(id!));
  });
});

describe('mode handoff wiring (source)', () => {
  it('Classic and Opening open analyzer via openPgnInAnalyzer', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    const opening = read('components/OpeningGameScreen.tsx');
    const modal = read('components/game/GameExportPgnModal.tsx');
    assert.match(classic, /openPgnInAnalyzer/);
    assert.match(classic, /onOpenInAnalyzer/);
    assert.match(opening, /openPgnInAnalyzer/);
    assert.match(opening, /onOpenInAnalyzer/);
    assert.match(modal, /game-export-open-analyzer/);
    assert.match(classic, /pathname:\s*['"]\/parties\/analyzer['"]|opened\.href/);
    assert.match(opening, /opened\.href/);
  });

  it('endgame Analyse CTAs call open*InReader adapters', () => {
    const endgame = read('app/puzzles/defends-nulle-play.tsx');
    const theoretical = read('app/puzzles/finales-theoriques-play.tsx');
    assert.match(endgame, /openEndgameInReader/);
    assert.doesNotMatch(
      endgame,
      /testID="endgame-analyse"[\s\S]{0,120}setOverlay\('analysis'\)/,
    );
    assert.match(theoretical, /openTheoreticalInReader/);
    assert.doesNotMatch(
      theoretical,
      /testID="theoretical-analyse"[\s\S]{0,120}setOverlay\('analysis'\)/,
    );
  });

  it('library and adapters never prefer legacy /parties/[gameId] string routes', () => {
    const library = read('app/parties/index.tsx');
    const endAdapter = read('lib/endgameTraining/review/EndgameAnalysisAdapter.ts');
    const thAdapter = read(
      'lib/theoreticalEndgame/review/TheoreticalAnalysisAdapter.ts',
    );
    assert.match(library, /pathname:\s*['"]\/parties\/analyzer['"]/);
    assert.doesNotMatch(library, /\/parties\/\$\{/);
    assert.doesNotMatch(endAdapter, /\/parties\/analyzer\?gameId=/);
    assert.doesNotMatch(thAdapter, /\/parties\/analyzer\?gameId=/);
    assert.match(endAdapter, /openPgnInAnalyzer|buildAnalyzerHref/);
    assert.match(thAdapter, /openPgnInAnalyzer|buildAnalyzerHref/);
  });

  it('puzzle / blind result screens do not force library handoff', () => {
    const puzzle = read('components/puzzles/PuzzleResultsPhase.tsx');
    const blind = read('components/blind/BlindResultsPhase.tsx');
    assert.doesNotMatch(puzzle, /openPgnInAnalyzer|gameLibraryStore/);
    assert.doesNotMatch(blind, /openPgnInAnalyzer|gameLibraryStore/);
  });
});
