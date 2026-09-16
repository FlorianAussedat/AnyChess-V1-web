import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import {
  extractClkFromComment,
  stripClkTags,
  importPgnGames,
  fingerprintGame,
  fenAtPly,
  createPlaybackSnapshot,
  nextPly,
  previousPly,
  clampPly,
  formatPlyLabel,
  GameLibraryStore,
  GamePlaybackScheduler,
  emptyGameLibrarySnapshot,
  validateGameLibrarySnapshot,
  type PlaybackSpeechPort,
} from '../index.ts';
import { dictationPaceToGapMs } from '../../preferences/dictationPace.ts';

const SAMPLE_PGN = `[Event "World Blitz Championship"]
[Site "New York"]
[Date "2024.12.30"]
[White "Magnus Carlsen"]
[Black "Maxime Vachier-Lagrave"]
[Result "1-0"]
[ECO "B90"]

1. e4 {[%clk 0:02:59]} c5 {[%clk 0:02:58]} 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 1-0
`;

const MULTI_PGN = `[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 1-0

[White "C"]
[Black "D"]
[Result "0-1"]

1. d4 d5 0-1
`;

describe('gameLibrary clk', () => {
  it('extracts [%clk] values from comments', () => {
    assert.equal(extractClkFromComment('[%clk 0:02:31]'), '0:02:31');
    assert.equal(extractClkFromComment('good {[%clk 1:00:00]}'), '1:00:00');
    assert.equal(extractClkFromComment('prefix [%clk 0:01:02] suffix'), '0:01:02');
    assert.equal(extractClkFromComment(undefined), undefined);
  });

  it('strips clk tags for prose display', () => {
    assert.equal(stripClkTags('[%clk 0:02:31]'), undefined);
    assert.equal(stripClkTags('Nice shot [%clk 0:01:00]'), 'Nice shot');
  });
});

describe('gameLibrary importPgnGames', () => {
  it('imports a normal game with metadata and clocks', () => {
    const result = importPgnGames(SAMPLE_PGN, { fileName: 'sample.pgn' });
    assert.equal(result.imported.length, 1);
    assert.equal(result.skippedInvalid, 0);
    const g = result.imported[0]!;
    assert.equal(g.headers.white, 'Magnus Carlsen');
    assert.equal(g.headers.black, 'Maxime Vachier-Lagrave');
    assert.equal(g.headers.result, '1-0');
    assert.equal(g.headers.event, 'World Blitz Championship');
    assert.equal(g.headers.eco, 'B90');
    assert.ok(g.moves.length >= 10);
    assert.equal(g.moves[0]!.san, 'e4');
    assert.equal(g.moves[0]!.clock, '0:02:59');
    assert.equal(g.moves[1]!.clock, '0:02:58');
    assert.equal(g.source.fileName, 'sample.pgn');
  });

  it('imports all games from a multi-game PGN', () => {
    const result = importPgnGames(MULTI_PGN);
    assert.equal(result.imported.length, 2);
    assert.equal(result.imported[0]!.headers.white, 'A');
    assert.equal(result.imported[1]!.headers.white, 'C');
  });

  it('preserves comments on moves', () => {
    const pgn = `[White "W"]
[Black "B"]
[Result "*"]

1. e4 {central strike} e5 *
`;
    const result = importPgnGames(pgn);
    assert.equal(result.imported.length, 1);
    assert.match(result.imported[0]!.moves[0]!.comment ?? '', /central strike/);
  });

  it('flags variations and keeps rawPgn for later (main line only in V1)', () => {
    const pgn = `[White "W"]
[Black "B"]
[Result "*"]

1. e4 e5 2. Nf3 (2. Nc3) Nc6 *
`;
    const result = importPgnGames(pgn);
    assert.equal(result.imported.length, 1);
    const g = result.imported[0]!;
    assert.equal(g.hasVariations, true);
    assert.ok(g.source.rawPgn && g.source.rawPgn.includes('(2. Nc3)'));
    // Main line only: e4 e5 Nf3 Nc6 — not Nc3
    assert.deepEqual(
      g.moves.map((m) => m.san),
      ['e4', 'e5', 'Nf3', 'Nc6'],
    );
  });

  it('supports custom starting FEN', () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
    const pgn = `[SetUp "1"]
[FEN "${fen}"]
[White "W"]
[Black "B"]
[Result "*"]

1. e4 *
`;
    const result = importPgnGames(pgn);
    assert.equal(result.imported.length, 1);
    assert.equal(result.imported[0]!.initialFen, fen);
    assert.equal(result.imported[0]!.moves[0]!.san, 'e4');
  });

  it('handles empty / invalid PGN safely', () => {
    assert.equal(importPgnGames('').imported.length, 0);
    assert.ok(importPgnGames('').errors.length > 0);
    const bad = importPgnGames(`[White "W"]\n[Black "B"]\n\n1. e4 Nf3 1-0\n`);
    assert.equal(bad.imported.length, 0);
    assert.ok(bad.skippedInvalid >= 1);
  });

  it('skips duplicates by fingerprint', () => {
    const first = importPgnGames(SAMPLE_PGN);
    const fp = new Set(first.imported.map((g) => g.fingerprint));
    const second = importPgnGames(SAMPLE_PGN, { existingFingerprints: fp });
    assert.equal(second.imported.length, 0);
    assert.equal(second.skippedDuplicates, 1);
  });
});

describe('gameLibrary playback helpers', () => {
  const game = importPgnGames(SAMPLE_PGN).imported[0]!;

  it('starts at initial position and navigates plies', () => {
    const start = createPlaybackSnapshot(game, 0);
    assert.equal(start.ply, 0);
    assert.equal(start.isAtStart, true);
    assert.equal(start.fen, game.initialFen);
    assert.equal(start.lastSan, null);

    const one = createPlaybackSnapshot(game, nextPly(game, 0));
    assert.equal(one.ply, 1);
    assert.equal(one.lastSan, 'e4');
    assert.equal(one.fen, fenAtPly(game, 1));

    const back = previousPly(game, one.ply);
    assert.equal(back, 0);
    assert.equal(clampPly(game, 999), game.moves.length);
  });

  it('formats ply labels and end position', () => {
    assert.equal(formatPlyLabel(game, 0), '—');
    assert.equal(formatPlyLabel(game, 1), '1.e4');
    assert.equal(formatPlyLabel(game, 2), '1...c5');
    const end = createPlaybackSnapshot(game, game.moves.length);
    assert.equal(end.isAtEnd, true);
  });

  it('builds stable fingerprints', () => {
    const a = fingerprintGame(game.headers, game.initialFen, game.moves.map((m) => m.san));
    const b = fingerprintGame(game.headers, game.initialFen, game.moves.map((m) => m.san));
    assert.equal(a, b);
  });
});

describe('gameLibrary persistence', () => {
  it('saves and reloads imported games without touching other keys', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem('anychess.preferences.user.v1', '{"keep":true}');
    const store = new GameLibraryStore(storage);
    const result = await store.importPgnText(MULTI_PGN, 'multi.pgn');
    assert.equal(result.imported.length, 2);
    const listed = await store.listGames();
    assert.equal(listed.length, 2);

    const again = new GameLibraryStore(storage);
    const reloaded = await again.listGames();
    assert.equal(reloaded.length, 2);
    assert.equal(await storage.getItem('anychess.preferences.user.v1'), '{"keep":true}');

    await again.deleteGame(reloaded[0]!.id);
    assert.equal((await again.listGames()).length, 1);
  });

  it('validates snapshots', () => {
    assert.deepEqual(validateGameLibrarySnapshot(null), null);
    assert.deepEqual(validateGameLibrarySnapshot(emptyGameLibrarySnapshot()), {
      version: 2,
      folders: [],
      games: [],
    });
  });

  it('migrates v1 snapshots to v2 with games at root', () => {
    const migrated = validateGameLibrarySnapshot({
      version: 1,
      games: [
        {
          id: 'g1',
          fingerprint: 'fp',
          headers: {},
          initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: [],
          hasVariations: false,
          source: { importedAt: 1 },
        },
      ],
    });
    assert.equal(migrated?.version, 2);
    assert.equal(migrated?.folders.length, 0);
    assert.equal(migrated?.games[0]?.folderId, null);
  });

  it('clears durable Analysée badges (session-only status)', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem(
      'anychess.gameLibrary.v1',
      JSON.stringify({
        version: 2,
        folders: [],
        games: [
          {
            id: 'g1',
            fingerprint: 'fp',
            headers: {},
            initialFen:
              'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            moves: [
              {
                ply: 1,
                san: 'e4',
                fenAfter:
                  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
              },
            ],
            hasVariations: false,
            source: { importedAt: 1 },
            analysis: {
              hasBeenAnalyzed: true,
              analyzedAt: 1,
              profileId: 'normal',
            },
          },
        ],
      }),
    );
    const store = new GameLibraryStore(storage);
    const game = await store.getGame('g1');
    assert.equal(game?.analysis, undefined);

    const result = await store.importPgnText(SAMPLE_PGN, 'sample.pgn');
    const imported = result.imported[0]!;
    const cleared = await store.markAnalyzed(imported.id, {
      profileId: 'normal',
      analyzedAt: 42,
    });
    assert.equal(cleared?.analysis, undefined);
  });
});

function createMockSpeech(): PlaybackSpeechPort & {
  spoken: string[];
  cancelReasons: string[];
} {
  const spoken: string[] = [];
  const cancelReasons: string[] = [];
  return {
    spoken,
    cancelReasons,
    async speakSan(san: string) {
      spoken.push(san);
    },
    cancel(reason: string) {
      cancelReasons.push(reason);
    },
  };
}

function controllableDelay() {
  const pending: Array<{ resolve: () => void; cancelled: () => boolean }> = [];
  return {
    pending,
    delay(ms: number, signal: { cancelled: () => boolean }) {
      return new Promise<void>((resolve) => {
        pending.push({
          resolve: () => {
            if (!signal.cancelled()) resolve();
            else resolve();
          },
          cancelled: signal.cancelled,
        });
      });
    },
    async flushOne() {
      const item = pending.shift();
      if (!item) throw new Error('no pending delay');
      item.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('gameLibrary GamePlaybackScheduler', () => {
  const game = importPgnGames(SAMPLE_PGN).imported[0]!;

  it('play advances plies then stops at end', async () => {
    const speech = createMockSpeech();
    const delays = controllableDelay();
    const states: number[] = [];
    const scheduler = new GamePlaybackScheduler({
      game,
      speech,
      initialPace: 'fast',
      delay: delays.delay,
      onStateChange: (s) => states.push(s.ply),
    });

    scheduler.play();
    // Allow first speak to complete (sync mock)
    await Promise.resolve();
    assert.equal(scheduler.getState().ply, 1);
    assert.equal(speech.spoken[0], 'e4');

    // After each gap, next move
    while (scheduler.getState().isPlaying && delays.pending.length > 0) {
      await delays.flushOne();
      await Promise.resolve();
    }
    // Drain remaining microtasks until ended
    for (let i = 0; i < game.moves.length + 5; i += 1) {
      if (delays.pending.length > 0) await delays.flushOne();
      await Promise.resolve();
    }

    assert.equal(scheduler.getState().ended, true);
    assert.equal(scheduler.getState().isPlaying, false);
    assert.equal(scheduler.getState().ply, game.moves.length);
    assert.equal(speech.spoken.length, game.moves.length);
    scheduler.dispose();
  });

  it('pause stops progression and cancels speech', async () => {
    const speech = createMockSpeech();
    const delays = controllableDelay();
    const scheduler = new GamePlaybackScheduler({
      game,
      speech,
      initialPace: 'fast',
      delay: delays.delay,
    });
    scheduler.play();
    await Promise.resolve();
    assert.equal(scheduler.getState().ply, 1);
    scheduler.pause();
    assert.equal(scheduler.getState().isPlaying, false);
    assert.ok(speech.cancelReasons.includes('pause'));
    const spokenAfterPause = speech.spoken.length;
    if (delays.pending.length > 0) await delays.flushOne();
    await Promise.resolve();
    assert.equal(speech.spoken.length, spokenAfterPause);
    scheduler.dispose();
  });

  it('changing pace affects subsequent gaps', async () => {
    const speech = createMockSpeech();
    const gaps: number[] = [];
    const scheduler = new GamePlaybackScheduler({
      game,
      speech,
      initialPace: 'medium',
      delay: async (ms) => {
        gaps.push(ms);
      },
    });
    scheduler.play();
    await Promise.resolve();
    scheduler.setPace('fast');
    // Let a few steps run
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
    scheduler.pause();
    assert.ok(gaps.length >= 1);
    assert.ok(gaps.every((g) => g === dictationPaceToGapMs('medium') || g === dictationPaceToGapMs('fast')));
    assert.ok(gaps.some((g) => g === dictationPaceToGapMs('fast')));
    scheduler.dispose();
  });

  it('jump cancels speech and does not auto-play', async () => {
    const speech = createMockSpeech();
    const scheduler = new GamePlaybackScheduler({
      game,
      speech,
      initialPace: 'fast',
      delay: async () => {},
    });
    scheduler.play();
    await Promise.resolve();
    scheduler.jumpTo(5);
    assert.equal(scheduler.getState().ply, 5);
    assert.equal(scheduler.getState().isPlaying, false);
    assert.ok(speech.cancelReasons.includes('jump'));
    const count = speech.spoken.length;
    await Promise.resolve();
    assert.equal(speech.spoken.length, count);
    scheduler.dispose();
  });

  it('repeatLast speaks without advancing ply', async () => {
    const speech = createMockSpeech();
    const scheduler = new GamePlaybackScheduler({
      game,
      speech,
      delay: async () => {},
    });
    scheduler.jumpTo(3);
    speech.spoken.length = 0;
    speech.cancelReasons.length = 0;
    await scheduler.repeatLast();
    assert.equal(scheduler.getState().ply, 3);
    assert.deepEqual(speech.spoken, [game.moves[2]!.san]);
    scheduler.dispose();
  });

  it('dispose stops further playback', async () => {
    const speech = createMockSpeech();
    const delays = controllableDelay();
    const scheduler = new GamePlaybackScheduler({
      game,
      speech,
      initialPace: 'fast',
      delay: delays.delay,
    });
    scheduler.play();
    await Promise.resolve();
    scheduler.dispose();
    const spoken = speech.spoken.length;
    if (delays.pending.length > 0) await delays.flushOne();
    await Promise.resolve();
    assert.equal(speech.spoken.length, spoken);
    assert.equal(scheduler.getState().isPlaying, false);
  });

  it('exposes training context fen at current ply', () => {
    const speech = createMockSpeech();
    const scheduler = new GamePlaybackScheduler({ game, speech, delay: async () => {} });
    scheduler.jumpTo(2);
    const ctx = scheduler.getTrainingContext();
    assert.equal(ctx.fen, fenAtPly(game, 2));
    assert.equal(ctx.sans.length, 2);
    assert.equal(ctx.gameId, game.id);
    scheduler.dispose();
  });

  it('visibility-independent: ply survives conceptual hide/show', () => {
    // Board/move visibility is UI-only; scheduler ply is the source of truth.
    const speech = createMockSpeech();
    const scheduler = new GamePlaybackScheduler({ game, speech, delay: async () => {} });
    scheduler.jumpTo(7);
    const fen = fenAtPly(game, 7);
    assert.equal(scheduler.getTrainingContext().fen, fen);
    assert.equal(createPlaybackSnapshot(game, 7).fen, fen);
    scheduler.dispose();
  });
});
