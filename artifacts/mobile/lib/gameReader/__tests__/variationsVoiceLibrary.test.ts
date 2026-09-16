import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReaderPgn,
  createGameReaderState,
  goToNext,
  goToNode,
  goToEnd,
  flipBoard,
  parseReaderVoiceCommand,
  createReaderPlayback,
  saveSharedReaderPosition,
  loadSharedReaderPosition,
  clearSharedReaderPosition,
} from '../index.ts';
import {
  GameLibraryStore,
  importPgnGames,
  gameHasUsableName,
  gameLibraryTitle,
} from '../../gameLibrary/index.ts';
import type { KeyValueStorage } from '../../storage/KeyValueStorage.ts';

const VARIATION_PGN = `[White "W"]
[Black "B"]

1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nxe5) 3. Bb5 a6 *`;

const NESTED_PGN = `1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nxe5 (3. d3)) 3. Bb5 *`;

describe('gameReader variations', () => {
  it('keeps main line and side variation children', () => {
    const result = parseReaderPgn(VARIATION_PGN);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.game.hasVariations, true);
    assert.deepEqual(
      result.game.moves.map((m) => m.san),
      ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
    );
    const nf3 = Object.values(result.game.nodesById).find((n) => n.san === 'Nf3');
    assert.ok(nf3);
    assert.deepEqual(
      nf3!.childIds.map((id) => result.game.nodesById[id]!.san),
      ['Nc6', 'Nf6'],
    );
  });

  it('selecting a variation updates fen and navigation', () => {
    const result = parseReaderPgn(VARIATION_PGN);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const game = result.game;
    let state = createGameReaderState(game, 0);
    state = goToNext(state);
    state = goToNext(state);
    state = goToNext(state);
    const nf3Id = state.currentNodeId!;
    const nf6Id = game.nodesById[nf3Id]!.childIds[1]!;
    state = goToNode(state, nf6Id);
    assert.equal(state.currentSan, 'Nf6');
    assert.deepEqual(
      state.activeLineNodeIds.map((id) => game.nodesById[id]!.san),
      ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5'],
    );
    state = goToNext(state);
    assert.equal(state.currentSan, 'Nxe5');
    state = goToNode(state, game.nodesById[nf3Id]!.childIds[0]!);
    assert.equal(state.currentSan, 'Nc6');
  });

  it('supports nested variations', () => {
    const result = parseReaderPgn(NESTED_PGN);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const nf6 = Object.values(result.game.nodesById).find((n) => n.san === 'Nf6');
    assert.ok(nf6);
    assert.ok(nf6!.childIds.length >= 1);
    assert.equal(result.game.nodesById[nf6!.childIds[0]!]!.parentId, nf6!.id);
  });

  it('flip does not change fen/node/branch', () => {
    const result = parseReaderPgn(VARIATION_PGN);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    let state = createGameReaderState(result.game, 0);
    state = goToEnd(state);
    const before = {
      fen: state.currentFen,
      ply: state.currentPly,
      node: state.currentNodeId,
      line: [...state.activeLineNodeIds],
    };
    state = flipBoard(state);
    assert.equal(state.boardFlipped, true);
    assert.equal(state.currentFen, before.fen);
    assert.equal(state.currentPly, before.ply);
    assert.equal(state.currentNodeId, before.node);
    assert.deepEqual(state.activeLineNodeIds, before.line);
  });
});

describe('parseReaderVoiceCommand', () => {
  const cases: Array<[string, string]> = [
    ['répète le dernier coup', 'repeatMoves'],
    ['répète les 3 derniers coups', 'repeatMoves'],
    ['répète les 3 derniers coups 3 fois', 'repeatMoves'],
    ['répète toute la partie', 'repeatAll'],
    ['pause', 'pause'],
    ['continue', 'continue'],
    ['coup suivant', 'nextMove'],
    ['coup précédent', 'previousMove'],
    ['reprends depuis le début', 'restart'],
  ];
  for (const [phrase, type] of cases) {
    it(`parses « ${phrase} »`, () => {
      const cmd = parseReaderVoiceCommand(phrase);
      assert.ok(cmd);
      assert.equal(cmd!.type, type);
    });
  }
  it('parses count/repetitions', () => {
    const cmd = parseReaderVoiceCommand('répète les 3 derniers coups 3 fois');
    assert.equal(cmd?.type, 'repeatMoves');
    if (cmd?.type === 'repeatMoves') {
      assert.equal(cmd.count, 3);
      assert.equal(cmd.repetitions, 3);
    }
  });
});

describe('readerPlayback mocks', () => {
  it('play / repeat / cancel', async () => {
    const result = parseReaderPgn('1. e4 e5 2. Nf3 *');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const spoken: string[] = [];
    const reached: string[] = [];
    const playback = createReaderPlayback({
      pace: 'fast',
      gapMs: 0,
      speakAndWait: async (text) => {
        spoken.push(text);
      },
      cancelSpeech: () => {},
    });
    const handle = playback.playFrom(result.game, null, (id) => reached.push(id));
    await handle.done;
    assert.equal(reached.length, 3);
    assert.equal(spoken.length, 3);
    await playback.repeatMovesAudio(result.game, reached[2]!, 2, 2).done;
    assert.equal(spoken.length, 7);
    const all = playback.repeatAllAudio(result.game, reached[2]!);
    all.cancel();
    playback.cancel('test');
  });
});

describe('shared reader position', () => {
  it('preserves node and fen across handoff', () => {
    clearSharedReaderPosition();
    const result = parseReaderPgn(VARIATION_PGN);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    let state = createGameReaderState(result.game, 0);
    state = goToNext(state);
    state = goToNext(state);
    state = goToNext(state);
    const nf6 = result.game.nodesById[state.currentNodeId!]!.childIds[1]!;
    state = goToNode(state, nf6);
    saveSharedReaderPosition({
      gameId: result.game.id,
      nodeId: state.currentNodeId,
      fen: state.currentFen,
      boardFlipped: true,
      activeLineNodeIds: state.activeLineNodeIds,
    });
    const loaded = loadSharedReaderPosition(result.game.id);
    assert.ok(loaded);
    assert.equal(loaded!.nodeId, nf6);
    assert.equal(loaded!.fen, state.currentFen);
    const restored = createGameReaderState(
      result.game,
      loaded!.nodeId,
      loaded!.boardFlipped,
    );
    assert.equal(restored.currentNodeId, nf6);
    assert.equal(restored.currentFen, state.currentFen);
    assert.equal(restored.boardFlipped, true);
  });
});

class MemoryStorage implements KeyValueStorage {
  private data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
}

describe('gameLibrary naming and delete', () => {
  it('requires usable metadata or displayName', () => {
    const unnamed = importPgnGames('1. e4 e5 *');
    assert.equal(unnamed.imported.length, 1);
    assert.equal(gameHasUsableName(unnamed.imported[0]!.headers), false);
    const named = {
      ...unnamed.imported[0]!,
      displayName: '  Ma partie  ',
    };
    assert.equal(gameLibraryTitle(named), 'Ma partie');
  });

  it('keeps player names when present', () => {
    const g = importPgnGames('[White "A"]\n[Black "B"]\n\n1. e4 *').imported[0]!;
    assert.equal(gameHasUsableName(g.headers), true);
    assert.match(gameLibraryTitle(g), /A/);
  });

  it('treats Event as usable name when players are missing', () => {
    const g = importPgnGames('[Event "Ruy Lopez Study"]\n\n1. e4 e5 *').imported[0]!;
    assert.equal(gameHasUsableName(g.headers), true);
    assert.equal(gameLibraryTitle(g), 'Ruy Lopez Study');
  });

  it('deletes one game and persists', async () => {
    const storage = new MemoryStorage();
    const store = new GameLibraryStore(storage);
    const a = importPgnGames('[White "A1"]\n[Black "A2"]\n\n1. e4 e5 *').imported[0]!;
    const b = importPgnGames('[White "B1"]\n[Black "B2"]\n\n1. d4 d5 *').imported[0]!;
    await store.addGames([a, b]);
    assert.equal((await store.listGames()).length, 2);
    await store.deleteGame(a.id);
    assert.equal((await store.listGames()).length, 1);
    await store.deleteGame('missing');
    assert.equal((await store.listGames()).length, 1);
    const again = new GameLibraryStore(storage);
    assert.equal((await again.listGames())[0]!.id, b.id);
  });
});
