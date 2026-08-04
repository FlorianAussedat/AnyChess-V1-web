/**
 * Continue la ligne — core session tests (no microphone).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { buildRepertoire, movesForPosition } from '../../repertoire/repertoireTree.ts';
import {
  ContinueLineSession,
  fenAfterSans,
  isBookUci,
  pickStartPly,
  proposedContinuationSans,
  sampleRandomPath,
  enumerateRepertoirePaths,
} from '../index.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { ContinueLineRecentStorage } from '../ContinueLineRecentStorage.ts';

const ITALIAN = `
[Event "Italian"]
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *
`;

const TWO_BRANCHES = `
[Event "A"]
1. e4 e5 2. Nf3 Nc6 3. Bc4 *
[Event "B"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 *
`;

const WITH_DUP = `
1. e4 e5 2. Nf3 *
1. e4 e5 2. Nf3 Nc6 *
`;

function forceRng(sequence: number[]): () => number {
  let i = 0;
  return () => {
    const v = sequence[i] ?? 0;
    i += 1;
    return v;
  };
}

describe('sampleRandomPath', () => {
  it('builds a path from a single PGN', () => {
    const rep = buildRepertoire(ITALIAN);
    const path = sampleRandomPath(rep, { rng: () => 0 });
    assert.ok(path);
    assert.ok(path!.sans.length >= 5);
    assert.equal(path!.sans[0], 'e4');
  });

  it('merges duplicate moves across PGNs', () => {
    const rep = buildRepertoire(WITH_DUP);
    const atStart = movesForPosition(rep, new Chess().fen());
    assert.equal(atStart.length, 1);
    assert.equal(atStart[0].san, 'e4');
  });
});

describe('multiple valid continuations', () => {
  it('lists both Bc4 and Bb5 after Nc6', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const chess = new Chess();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) chess.move(san);
    const moves = movesForPosition(rep, chess.fen()).map((m) => m.san).sort();
    assert.deepEqual(moves, ['Bb5', 'Bc4']);
  });

  it('accepts either branch as a book move', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const chess = new Chess();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) chess.move(san);
    const fen = chess.fen();
    const bc4 = chess.move('Bc4')!;
    assert.equal(isBookUci(rep, fen, bc4.from, bc4.to), true);
    chess.undo();
    const bb5 = chess.move('Bb5')!;
    assert.equal(isBookUci(rep, fen, bb5.from, bb5.to), true);
  });
});

describe('pickStartPly', () => {
  it('returns 0 for short paths', () => {
    assert.equal(pickStartPly(2, { minTail: 3 }), 0);
  });

  it('can start mid-line when long enough', () => {
    const ply = pickStartPly(10, { minTail: 3, rng: () => 0.99 });
    assert.ok(ply >= 0);
    assert.ok(ply <= 7);
  });
});

describe('ContinueLineSession', () => {
  it('counts correct moves and completes the line', () => {
    const rep = buildRepertoire(ITALIAN);
    const session = new ContinueLineSession();
    session.start(rep, 'Italien', {
      rng: forceRng([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      startPly: 0,
    });
    session.beginRecitation();

    const board = new Chess();
    const path = sampleRandomPath(rep, { rng: () => 0 })!;
    // Follow first path from the same seed... session already started with startPly 0
    // Just play all moves from movesForPosition iteratively preferring first.
    let guard = 0;
    while (session.snapshot().phase === 'reciting' && guard++ < 20) {
      const fen = session.snapshot().currentFen;
      const moves = movesForPosition(rep, fen);
      assert.ok(moves.length > 0, 'expected book move');
      const probe = new Chess(fen);
      const played = probe.move(moves[0].san)!;
      const result = session.applyChessMove(played);
      assert.equal(result.kind, 'correct');
    }
    assert.equal(session.snapshot().phase, 'completed');
    assert.equal(session.snapshot().lineCompleted, true);
    assert.ok(session.snapshot().correctCount > 0);
  });

  it('stops on first incorrect repertoire move and lists alternatives', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const session = new ContinueLineSession();
    // Build a fixed path: e4 e5 Nf3 Nc6 Bc4
    const path = {
      id: 'fixed',
      sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      fensBefore: [] as string[],
      choices: [] as never[],
    };
    // fill fensBefore
    const tmp = new Chess();
    for (const san of path.sans) {
      path.fensBefore.push(tmp.fen());
      tmp.move(san);
    }

    session.start(rep, 'Test', { path, startPly: 4 }); // start before Bc4
    session.beginRecitation();

    const fen = session.snapshot().currentFen;
    const probe = new Chess(fen);
    // Play illegal-for-book: a3
    const wrong = probe.move('a3')!;
    const result = session.applyChessMove(wrong);
    assert.equal(result.kind, 'wrong');
    assert.equal(session.snapshot().phase, 'failed');
    assert.equal(session.snapshot().incorrectSan, 'a3');
    const alts = [...session.snapshot().validAlternatives].sort();
    assert.deepEqual(alts, ['Bb5', 'Bc4']);
    assert.ok(session.snapshot().proposedContinuation.length >= 1);
  });

  it('accepts the other valid fork without failing', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const session = new ContinueLineSession();
    const path = {
      id: 'prefer-bc4',
      sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      fensBefore: [] as string[],
      choices: [] as never[],
    };
    const tmp = new Chess();
    for (const san of path.sans) {
      path.fensBefore.push(tmp.fen());
      tmp.move(san);
    }
    session.start(rep, 'Test', { path, startPly: 4 });
    session.beginRecitation();
    const fen = session.snapshot().currentFen;
    const probe = new Chess(fen);
    const bb5 = probe.move('Bb5')!;
    const result = session.applyChessMove(bb5);
    assert.equal(result.kind, 'correct');
    assert.equal(session.snapshot().phase, 'completed'); // Bb5 is a leaf in our mini book
  });

  it('does not treat recognition failure as a repertoire error', () => {
    const rep = buildRepertoire(ITALIAN);
    const session = new ContinueLineSession();
    session.start(rep, 'Italien', { startPly: 0, rng: () => 0 });
    session.beginRecitation();
    const before = session.snapshot().correctCount;
    session.recordRecognitionFailure();
    assert.equal(session.snapshot().phase, 'reciting');
    assert.equal(session.snapshot().correctCount, before);
    assert.equal(session.snapshot().incorrectSan, null);
  });
});

describe('fenAfterSans / proposedContinuation', () => {
  it('computes cue fen', () => {
    const fen = fenAfterSans(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      ['e4', 'e5'],
    );
    assert.match(fen, /^rnbqkbnr\/pppp1ppp\/8\/4p3\/4P3\/8\/PPPP1PPP\/RNBQKBNR w/);
  });

  it('proposes a first-line continuation', () => {
    const rep = buildRepertoire(ITALIAN);
    const cont = proposedContinuationSans(rep, new Chess().fen(), 6);
    assert.deepEqual(cont.slice(0, 2), ['e4', 'e5']);
  });
});

describe('ContinueLineRecentStorage', () => {
  it('stores recent path ids per folder', async () => {
    const mem = new MemoryKeyValueStorage();
    const store = new ContinueLineRecentStorage(mem);
    await store.pushRecentPathId('f1', 'a b c');
    await store.pushRecentPathId('f1', 'd e');
    const ids = await store.getRecentPathIds('f1');
    assert.deepEqual(ids, ['d e', 'a b c']);
  });

  it('keeps a short consecutive streak for anti-repeat', async () => {
    const mem = new MemoryKeyValueStorage();
    const store = new ContinueLineRecentStorage(mem);
    await store.pushRecentPathId('f1', 'lineA');
    await store.pushRecentPathId('f1', 'lineA');
    assert.deepEqual(await store.getRecentPathIds('f1'), ['lineA', 'lineA']);
    await store.pushRecentPathId('f1', 'lineA');
    assert.deepEqual(await store.getRecentPathIds('f1'), ['lineA', 'lineA']);
  });
});

describe('enumerateRepertoirePaths + reachability', () => {
  it('enumerates every leaf path', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const paths = enumerateRepertoirePaths(rep);
    const ids = paths.map((p) => p.id).sort();
    assert.ok(ids.some((id) => id.includes('Bc4')));
    assert.ok(ids.some((id) => id.includes('Bb5')));
  });
});

describe('sampleRandomPath anti-repeat', () => {
  it('can eventually select every valid path', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const all = enumerateRepertoirePaths(rep);
    assert.ok(all.length >= 2);
    const seen = new Set<string>();
    let cursor = 0;
    const rng = () => {
      const v = (cursor % all.length) / all.length;
      cursor += 1;
      return v;
    };
    for (let i = 0; i < 40; i++) {
      const path = sampleRandomPath(rep, { rng, recentPathIds: [...seen].slice(-2) });
      assert.ok(path);
      seen.add(path!.id);
    }
    for (const p of all) {
      assert.ok(seen.has(p.id), `unreachable path: ${p.id}`);
    }
  });

  it('never allows a third consecutive duplicate when alternatives exist', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const all = enumerateRepertoirePaths(rep);
    assert.ok(all.length >= 2);
    const a = all[0]!.id;
    const recent = [a, a];
    for (let i = 0; i < 20; i++) {
      const path = sampleRandomPath(rep, { rng: () => i / 20, recentPathIds: recent });
      assert.ok(path);
      assert.notEqual(path!.id, a);
    }
  });

  it('allows repeating the only available line', () => {
    const rep = buildRepertoire(ITALIAN);
    const path = sampleRandomPath(rep, { rng: () => 0 })!;
    const again = sampleRandomPath(rep, {
      rng: () => 0,
      recentPathIds: [path.id, path.id],
    });
    assert.ok(again);
    assert.equal(again!.id, path.id);
  });

  it('prefers alternatives over immediate repeat', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const all = enumerateRepertoirePaths(rep);
    const a = all[0]!.id;
    const path = sampleRandomPath(rep, { rng: () => 0, recentPathIds: [a] });
    assert.ok(path);
    assert.notEqual(path!.id, a);
  });
});

describe('ContinueLineSession reachedSans', () => {
  it('hides Position atteinte until the first correct continuation', () => {
    const session = new ContinueLineSession();
    const path = {
      id: 'e4-e5-Nf3',
      sans: ['e4', 'e5', 'Nf3'],
      fensBefore: [] as string[],
      choices: [] as never[],
    };
    const tmp = new Chess();
    for (const san of path.sans) {
      path.fensBefore.push(tmp.fen());
      tmp.move(san);
    }
    session.start(buildRepertoire(ITALIAN), 'Test', { path, startPly: 2 });
    session.beginRecitation();
    assert.deepEqual(session.snapshot().preambleSans, ['e4', 'e5']);
    assert.deepEqual(session.snapshot().reachedSans, []);

    const fen = session.snapshot().currentFen;
    const probe = new Chess(fen);
    const nf3 = probe.move('Nf3')!;
    const result = session.applyChessMove(nf3);
    assert.equal(result.kind, 'correct');
    assert.deepEqual(session.snapshot().reachedSans, ['e4', 'e5', 'Nf3']);
  });

  it('does not include a rejected move in reachedSans', () => {
    const session = new ContinueLineSession();
    const path = {
      id: 'fixed',
      sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      fensBefore: [] as string[],
      choices: [] as never[],
    };
    const tmp = new Chess();
    for (const san of path.sans) {
      path.fensBefore.push(tmp.fen());
      tmp.move(san);
    }
    const rep = buildRepertoire(TWO_BRANCHES);
    session.start(rep, 'Test', { path, startPly: 4 });
    session.beginRecitation();
    const fen = session.snapshot().currentFen;
    const probe = new Chess(fen);
    const wrong = probe.move('a3')!;
    session.applyChessMove(wrong);
    assert.deepEqual(session.snapshot().reachedSans, []);
    assert.equal(session.snapshot().incorrectSan, 'a3');
  });
});
