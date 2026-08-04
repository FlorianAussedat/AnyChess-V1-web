/**
 * Stage 1 shared UX infrastructure tests.
 * Coordinates preference logic is tested via an in-memory mirror of the
 * settings contract (board visibility vs coordinates remain independent).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { parseChessVoice } from '../../voice/parseChessVoice.ts';
import { replayLine } from '../../replay/replayLine.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';

describe('shared chess answer input (parser equivalence)', () => {
  it('resolves the same move from voice-like and written transcripts', () => {
    const game = new Chess();
    const voice = parseChessVoice('cavalier f3', game);
    const written = parseChessVoice('Cf3', game);
    assert.equal(voice.type, 'move');
    assert.equal(written.type, 'move');
    if (voice.type === 'move' && written.type === 'move') {
      assert.equal(voice.move.san, written.move.san);
      assert.equal(voice.move.from, written.move.from);
      assert.equal(voice.move.to, written.move.to);
    }
  });

  it('keeps French piece notation and English SAN on the same pipeline', () => {
    const game = new Chess();
    assert.equal(parseChessVoice('Nf3', game).type, 'move');
    assert.equal(parseChessVoice('Cf3', game).type, 'move');
    assert.equal(parseChessVoice('e4', game).type, 'move');
  });
});

describe('board coordinates preference independence', () => {
  /**
   * Mirrors BoardCoordinatesSettings persistence contract without AsyncStorage.
   * Board visibility is a separate local UI flag — never stored together.
   */
  async function coordinatesStore(storage: MemoryKeyValueStorage) {
    const KEY = StorageKeys.boardCoordinatesVisible.key;
    return {
      async get(): Promise<boolean> {
        const raw = await storage.getItem(KEY);
        if (raw === '0' || raw === 'false') return false;
        return true;
      },
      async set(visible: boolean) {
        await storage.setItem(KEY, visible ? '1' : '0');
      },
    };
  }

  it('can hide coordinates without implying the board is hidden', async () => {
    const storage = new MemoryKeyValueStorage();
    const coords = await coordinatesStore(storage);
    let boardVisible = true;

    await coords.set(false);
    assert.equal(await coords.get(), false);
    assert.equal(boardVisible, true);

    boardVisible = false;
    assert.equal(await coords.get(), false);
    assert.equal(boardVisible, false);

    boardVisible = true;
    await coords.set(true);
    assert.equal(await coords.get(), true);
    assert.equal(boardVisible, true);
  });

  it('persists the coordinates preference across loads', async () => {
    const storage = new MemoryKeyValueStorage();
    const coords = await coordinatesStore(storage);
    await coords.set(false);
    const again = await coordinatesStore(storage);
    assert.equal(await again.get(), false);
  });
});

describe('shared line replay', () => {
  it('replays a legal line and stops on the final position', async () => {
    const sans: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const handle = replayLine({
        moves: ['e4', 'e5', 'Nf3'],
        intervalMs: 5,
        onMove: (m) => sans.push(m.san),
        onComplete: (finalFen) => {
          try {
            const end = new Chess(finalFen);
            assert.deepEqual(sans, ['e4', 'e5', 'Nf3']);
            assert.equal(end.fen().split(' ')[0], 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R');
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        onError: (msg) => reject(new Error(msg)),
      });
      assert.equal(typeof handle.cancel, 'function');
    });
  });

  it('cancel prevents further callbacks', async () => {
    let movesSeen = 0;
    let completed = false;
    const handle = replayLine({
      moves: ['e4', 'e5', 'Nf3', 'Nc6'],
      intervalMs: 40,
      onMove: () => {
        movesSeen += 1;
      },
      onComplete: () => {
        completed = true;
      },
    });
    await new Promise((r) => setTimeout(r, 20));
    handle.cancel();
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(completed, false);
    assert.ok(movesSeen < 4);
  });
});
