/**
 * Exercise → Lecteur/Analyseur handoff: startFen+moves vs terminal FEN,
 * SharedGameSession (anychess.gameSession.v1), navigation.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { GameLibraryStore } from '../GameLibraryStore.ts';
import { pgnFromFenAndSans, sideToMoveFromFen } from '../pgnFromFenAndSans.ts';
import {
  openExerciseGameInAnalyzer,
  openExercisePositionInAnalyzer,
} from '../openExerciseAnalyzer.ts';
import {
  __resetSharedGameSessionForTests,
  __setSharedGameSessionStorageForTests,
  loadSharedGameSession,
} from '../../gameReader/sharedReaderPosition.ts';
import {
  createGameReaderState,
  goToEnd,
  goToNext,
  goToPrevious,
  goToStart,
} from '../../gameReader/index.ts';
import { openEndgameInReader } from '../../endgameTraining/review/EndgameAnalysisAdapter.ts';
import { openTheoreticalInReader } from '../../theoreticalEndgame/review/TheoreticalAnalysisAdapter.ts';
import type { AttemptResult } from '../../endgameTraining/domain/types.ts';
import type { TheoreticalAttemptResult } from '../../theoreticalEndgame/domain/types.ts';

const START_FEN = '4k3/8/8/8/8/8/4K3/4Q3 b - - 0 1';

function replayFen(startFen: string, sans: string[]): string {
  const chess = new Chess(startFen);
  for (const san of sans) chess.move(san);
  return chess.fen();
}

beforeEach(() => {
  __setSharedGameSessionStorageForTests(new MemoryKeyValueStorage(), {
    debounceMs: 5,
  });
});

afterEach(() => {
  __resetSharedGameSessionForTests();
});

describe('pgnFromFenAndSans', () => {
  it('keeps the custom FEN and numbers Black-to-move with 1...', () => {
    const pgn = pgnFromFenAndSans({
      startFen: START_FEN,
      moveSans: ['Ke7', 'Kd1'],
      headers: { Event: 'Test' },
    });
    assert.match(pgn, /\[FEN "4k3\/8\/8\/8\/8\/8\/4K3\/4Q3 b - - 0 1"\]/);
    assert.match(pgn, /\[SetUp "1"\]/);
    assert.match(pgn, /1\.\.\. Ke7/);
    assert.match(pgn, /2\. Kd1/);
  });
});

describe('openExerciseGameInAnalyzer', () => {
  it('rebuilds notation from custom FEN + several plies and preserves side to move', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const moveSans = ['Ke7', 'Kd1+', 'Kd6'];
    const endFen = replayFen(START_FEN, moveSans);
    assert.equal(sideToMoveFromFen(endFen), 'w');
    assert.equal(moveSans.length % 2, 1);

    const opened = await openExerciseGameInAnalyzer({
      startFen: START_FEN,
      moveSans,
      event: 'Finales théoriques',
      fileName: 'theoretical-endgame.pgn',
      displayName: 'Finales théoriques',
      flipped: true,
      store,
    });
    assert.ok(opened);
    assert.equal(opened!.href.pathname, '/parties/analyzer');
    assert.equal(opened!.href.params.tab, 'analysis');
    assert.equal(opened!.href.params.flipped, '1');
    assert.equal(opened!.game.initialFen, START_FEN);
    assert.deepEqual(
      opened!.game.moves.map((m) => m.san),
      ['Ke7', 'Kd1+', 'Kd6'],
    );

    const session = await loadSharedGameSession(opened!.gameId);
    assert.ok(session);
    assert.equal(session!.game.initialFen, START_FEN);
    assert.equal(session!.currentNodeId, null);

    let state = createGameReaderState(session!.game, session!.currentNodeId);
    assert.equal(state.currentFen, START_FEN);
    assert.equal(state.sideToMove, 'black');
    assert.equal(state.totalPly, 3);

    state = goToNext(state);
    assert.equal(state.currentSan, 'Ke7');
    state = goToNext(state);
    assert.equal(state.currentSan, 'Kd1+');
    state = goToNext(state);
    assert.equal(state.currentFen, endFen);
    assert.equal(state.sideToMove, 'white');
    assert.equal(state.canGoForward, false);

    state = goToPrevious(state);
    assert.equal(state.currentSan, 'Kd1+');
    state = goToStart(state);
    assert.equal(state.currentFen, START_FEN);
    state = goToEnd(state);
    assert.equal(state.currentFen, endFen);
  });

  it('even ply count leaves Black to move', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const moveSans = ['Ke7', 'Kd1+'];
    const endFen = replayFen(START_FEN, moveSans);
    assert.equal(moveSans.length % 2, 0);
    assert.equal(sideToMoveFromFen(endFen), 'b');

    const opened = await openExerciseGameInAnalyzer({
      startFen: START_FEN,
      moveSans,
      event: 'Entraînement aux Finales',
      fileName: 'endgame-training.pgn',
      displayName: 'Entraînement aux Finales',
      store,
    });
    assert.ok(opened);
    const state = goToEnd(createGameReaderState(opened!.game, 0));
    assert.equal(state.currentFen, endFen);
    assert.equal(state.sideToMove, 'black');
  });
});

describe('openExercisePositionInAnalyzer', () => {
  it('loads only the terminal FEN (castling, EP, clocks, side to move)', async () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 5 22';
    const opened = await openExercisePositionInAnalyzer({ fen, flipped: false });
    assert.ok(opened);
    assert.equal(opened!.game.initialFen, fen);
    assert.equal(opened!.game.moves.length, 0);
    assert.equal(opened!.href.pathname, '/parties/analyzer');

    const session = await loadSharedGameSession(opened!.gameId);
    assert.ok(session);
    assert.equal(session!.game.initialFen, fen);
    assert.equal(session!.game.moves.length, 0);

    const state = createGameReaderState(session!.game, session!.currentNodeId);
    assert.equal(state.currentFen, fen);
    assert.equal(state.sideToMove, 'black');
    assert.equal(state.totalPly, 0);
    assert.equal(state.canGoBack, false);
    assert.equal(state.canGoForward, false);
    const parts = state.currentFen.split(/\s+/);
    assert.equal(parts[2], 'KQkq');
    assert.equal(parts[3], '-');
    assert.equal(parts[4], '5');
    assert.equal(parts[5], '22');
  });

  it('can tag the handoff as opening-editor with exploration origin at start', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const opened = await openExercisePositionInAnalyzer({
      fen,
      flipped: true,
      source: 'opening-editor',
      explorationOriginNodeId: '',
    });
    assert.ok(opened);
    assert.equal(opened!.href.params.source, 'opening-editor');
    assert.equal(opened!.href.params.flipped, '1');
    assert.equal(opened!.session.explorationOriginNodeId, '');
    const state = createGameReaderState(opened!.game, opened!.session.currentNodeId);
    assert.equal(state.currentFen, fen);
    assert.equal(state.sideToMove, 'black');
  });
});

describe('mode adapters', () => {
  const theoreticalResult: TheoreticalAttemptResult = {
    outcome: 'success',
    positionId: 'th-1',
    themeId: 'opposition',
    objective: 'WIN',
    playerColor: 'black',
    userMoves: 2,
    targetUserMoves: 5,
    attemptScore: 8,
    firstTheoreticalLoss: null,
    startFen: START_FEN,
    endFen: replayFen(START_FEN, ['Ke7', 'Kd1+']),
    moveSans: ['Ke7', 'Kd1+'],
    finishedAt: new Date().toISOString(),
    offScore: false,
  };

  const endgameResult: AttemptResult = {
    outcome: 'win-official-draw',
    movesResisted: 2,
    timeline: [],
    moveSans: ['Ke7', 'Kd1+'],
    startFen: START_FEN,
    endFen: replayFen(START_FEN, ['Ke7', 'Kd1+']),
    positionId: 'eg-1',
    finishedAt: new Date().toISOString(),
  };

  it('theoretical game vs position handoffs', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const pushed: unknown[] = [];
    const gameId = await openTheoreticalInReader({
      result: theoreticalResult,
      mode: 'game',
      store,
      routerPush: (href) => {
        pushed.push(href);
      },
    });
    assert.ok(gameId);
    const gameSession = await loadSharedGameSession(gameId!);
    assert.equal(gameSession!.game.initialFen, START_FEN);
    assert.equal(gameSession!.game.moves.length, 2);

    const posId = await openTheoreticalInReader({
      result: theoreticalResult,
      mode: 'position',
      routerPush: (href) => {
        pushed.push(href);
      },
    });
    assert.ok(posId);
    const posSession = await loadSharedGameSession(posId!);
    assert.equal(posSession!.game.initialFen, theoreticalResult.endFen);
    assert.equal(posSession!.game.moves.length, 0);
    assert.equal(pushed.length, 2);
  });

  it('defend-draw game vs position handoffs', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const gameId = await openEndgameInReader({
      result: endgameResult,
      defender: 'white',
      mode: 'game',
      store,
      routerPush: () => {},
    });
    assert.ok(gameId);
    const gameSession = await loadSharedGameSession(gameId!);
    assert.equal(gameSession!.game.initialFen, START_FEN);
    assert.equal(gameSession!.game.moves.length, 2);

    const posId = await openEndgameInReader({
      result: endgameResult,
      defender: 'white',
      mode: 'position',
      routerPush: () => {},
    });
    assert.ok(posId);
    const posSession = await loadSharedGameSession(posId!);
    assert.equal(posSession!.game.initialFen, endgameResult.endFen);
    assert.equal(posSession!.game.moves.length, 0);
  });
});
