/**
 * Shared Lecteur/AnyLyseur session persistence + exploration origin.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import {
  createGameReaderState,
  goToNext,
  parseReaderPgn,
} from '../index.ts';
import {
  playMoveOnReader,
  returnToExplorationOrigin,
  EXPLORATION_ORIGIN_START,
} from '../explorationMoves.ts';
import {
  __resetSharedGameSessionForTests,
  __setSharedGameSessionStorageForTests,
  clearSharedGameSession,
  flushSharedGameSession,
  loadSharedGameSession,
  peekSharedGameSession,
  saveSharedGameSession,
  scheduleSaveSharedGameSession,
  SHARED_GAME_SESSION_STORAGE_KEY,
  validateSharedGameSession,
} from '../sharedReaderPosition.ts';

const SHORT_PGN = `[White "White"]
[Black "Black"]
[Result "*"]

1. e4 e5 2. Nf3 *`;

beforeEach(() => {
  const storage = new MemoryKeyValueStorage();
  __setSharedGameSessionStorageForTests(storage, { debounceMs: 20 });
});

afterEach(() => {
  __resetSharedGameSessionForTests();
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('StorageKeys.gameSession', () => {
  it('registers the versioned session key', () => {
    assert.equal(StorageKeys.gameSession.key, 'anychess.gameSession.v1');
    assert.equal(SHARED_GAME_SESSION_STORAGE_KEY, 'anychess.gameSession.v1');
  });
});

describe('shared game session save/restore', () => {
  it('round-trips through storage and restores exploration origin', async () => {
    const storage = new MemoryKeyValueStorage();
    __setSharedGameSessionStorageForTests(storage, { debounceMs: 20 });

    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    let state = createGameReaderState(parsed.game, 0);
    state = goToNext(state); // e4
    const originBefore = state.currentNodeId;
    state = playMoveOnReader(state, 'b8', 'c6');
    assert.equal(state.explorationOriginNodeId, originBefore);

    await saveSharedGameSession({
      gameId: state.game.id,
      game: state.game,
      currentNodeId: state.currentNodeId,
      activeLineNodeIds: state.activeLineNodeIds,
      boardFlipped: true,
      explorationOriginNodeId: state.explorationOriginNodeId,
      analysisProfileId: 'fast',
      analysisCacheSummary: {
        analyzedNodeCount: 1,
        lastFen: state.currentFen,
        profileId: 'fast',
      },
    });

    // Simulate refresh: clear memory, keep storage.
    __setSharedGameSessionStorageForTests(storage, { debounceMs: 20 });
    assert.equal(peekSharedGameSession(), null);

    const loaded = await loadSharedGameSession(state.game.id);
    assert.ok(loaded);
    assert.equal(loaded!.gameId, state.game.id);
    assert.equal(loaded!.currentNodeId, state.currentNodeId);
    assert.equal(loaded!.boardFlipped, true);
    assert.equal(loaded!.explorationOriginNodeId, originBefore);
    assert.equal(loaded!.analysisProfileId, 'fast');
    assert.equal(loaded!.analysisCacheSummary?.analyzedNodeCount, 1);
    assert.ok(loaded!.game.nodesById[state.currentNodeId!]);
    assert.equal(
      loaded!.game.nodesById[state.currentNodeId!]!.san,
      'Nc6',
    );

    const restored = createGameReaderState(
      loaded!.game,
      loaded!.currentNodeId,
      loaded!.boardFlipped,
      loaded!.explorationOriginNodeId,
    );
    assert.equal(restored.currentNodeId, state.currentNodeId);
    assert.equal(restored.explorationOriginNodeId, originBefore);
    assert.equal(restored.boardFlipped, true);

    const back = returnToExplorationOrigin(restored);
    assert.equal(back.currentNodeId, originBefore);
    assert.equal(back.explorationOriginNodeId, originBefore);
    assert.ok(back.game.nodesById[state.currentNodeId!], 'variation kept');
  });

  it('debounces scheduleSave and does not require flush for eventual write', async () => {
    const storage = new MemoryKeyValueStorage();
    __setSharedGameSessionStorageForTests(storage, { debounceMs: 30 });

    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    let state = createGameReaderState(parsed.game, 1);

    scheduleSaveSharedGameSession({
      gameId: state.game.id,
      game: state.game,
      currentNodeId: state.currentNodeId,
      activeLineNodeIds: state.activeLineNodeIds,
      boardFlipped: false,
      explorationOriginNodeId: null,
    });
    state = goToNext(state);
    scheduleSaveSharedGameSession({
      gameId: state.game.id,
      game: state.game,
      currentNodeId: state.currentNodeId,
      activeLineNodeIds: state.activeLineNodeIds,
      boardFlipped: false,
      explorationOriginNodeId: null,
    });

    assert.equal(await storage.getItem(SHARED_GAME_SESSION_STORAGE_KEY), null);
    await sleep(50);
    const raw = await storage.getItem(SHARED_GAME_SESSION_STORAGE_KEY);
    assert.ok(raw);
    const parsedSession = validateSharedGameSession(JSON.parse(raw!));
    assert.ok(parsedSession);
    assert.equal(parsedSession!.currentNodeId, state.currentNodeId);
  });

  it('clearSharedGameSession removes only the session key', async () => {
    const storage = new MemoryKeyValueStorage();
    __setSharedGameSessionStorageForTests(storage, { debounceMs: 5 });
    await storage.setItem('anychess.other.v1', 'keep');

    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const state = createGameReaderState(parsed.game, 0);
    await saveSharedGameSession({
      gameId: state.game.id,
      game: state.game,
      currentNodeId: null,
      activeLineNodeIds: state.activeLineNodeIds,
      boardFlipped: false,
      explorationOriginNodeId: null,
    });
    await clearSharedGameSession();
    assert.equal(await storage.getItem(SHARED_GAME_SESSION_STORAGE_KEY), null);
    assert.equal(await storage.getItem('anychess.other.v1'), 'keep');
  });

  it('flushSharedGameSession writes pending debounce immediately', async () => {
    const storage = new MemoryKeyValueStorage();
    __setSharedGameSessionStorageForTests(storage, { debounceMs: 5000 });
    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const state = createGameReaderState(parsed.game, 1);
    scheduleSaveSharedGameSession({
      gameId: state.game.id,
      game: state.game,
      currentNodeId: state.currentNodeId,
      activeLineNodeIds: state.activeLineNodeIds,
      boardFlipped: false,
      explorationOriginNodeId: null,
    });
    assert.equal(await storage.getItem(SHARED_GAME_SESSION_STORAGE_KEY), null);
    await flushSharedGameSession();
    assert.ok(await storage.getItem(SHARED_GAME_SESSION_STORAGE_KEY));
  });
});

describe('exploration origin survival', () => {
  it('sets origin on first manual move and keeps it across further moves', () => {
    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    let state = createGameReaderState(parsed.game, 0);
    assert.equal(state.explorationOriginNodeId, null);

    state = goToNext(state); // e4
    const origin = state.currentNodeId;
    state = playMoveOnReader(state, 'b8', 'c6');
    assert.equal(state.explorationOriginNodeId, origin);
    const firstVar = state.currentNodeId;

    state = playMoveOnReader(state, 'b1', 'c3');
    assert.equal(state.explorationOriginNodeId, origin);
    assert.notEqual(state.currentNodeId, firstVar);
  });

  it('returnToExplorationOrigin keeps variations and origin', () => {
    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    let state = createGameReaderState(parsed.game, 0);
    state = goToNext(state);
    const origin = state.currentNodeId;
    state = playMoveOnReader(state, 'b8', 'c6');
    const varId = state.currentNodeId!;
    state = returnToExplorationOrigin(state);
    assert.equal(state.currentNodeId, origin);
    assert.equal(state.explorationOriginNodeId, origin);
    assert.ok(state.game.nodesById[varId]);
  });

  it('resets origin only when starting a new exploration after return', () => {
    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    let state = createGameReaderState(parsed.game, 0);
    state = goToNext(state);
    const firstOrigin = state.currentNodeId;
    state = playMoveOnReader(state, 'b8', 'c6');
    state = returnToExplorationOrigin(state);
    assert.equal(state.explorationOriginNodeId, firstOrigin);

    // New digression while sitting on origin → origin resets to this cursor.
    state = playMoveOnReader(state, 'g8', 'f6');
    assert.equal(state.explorationOriginNodeId, firstOrigin);
    assert.equal(state.game.nodesById[state.currentNodeId!]!.san, 'Nf6');
  });

  it('uses start sentinel when exploring from ply 0', () => {
    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    let state = createGameReaderState(parsed.game, 0);
    // Side root move: d4 instead of e4
    state = playMoveOnReader(state, 'd2', 'd4');
    assert.equal(state.explorationOriginNodeId, EXPLORATION_ORIGIN_START);
    assert.equal(state.game.nodesById[state.currentNodeId!]!.san, 'd4');
    assert.ok(state.game.rootIds.length >= 2);

    state = returnToExplorationOrigin(state);
    assert.equal(state.currentNodeId, null);
    assert.equal(state.currentPly, 0);
    assert.equal(state.explorationOriginNodeId, EXPLORATION_ORIGIN_START);
  });

  it('selects existing continuation instead of duplicating', () => {
    const parsed = parseReaderPgn(SHORT_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    let state = createGameReaderState(parsed.game, 0);
    const before = Object.keys(state.game.nodesById).length;
    state = playMoveOnReader(state, 'e2', 'e4');
    assert.equal(Object.keys(state.game.nodesById).length, before);
    assert.equal(state.currentSan, 'e4');
    // Existing main-line selection is not an exploration digression.
    assert.equal(state.explorationOriginNodeId, EXPLORATION_ORIGIN_START);
  });
});
