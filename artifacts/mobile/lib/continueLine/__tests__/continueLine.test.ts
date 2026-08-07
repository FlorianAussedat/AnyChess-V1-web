/**
 * Continue la ligne — core session tests (no microphone).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { buildRepertoire, movesForPosition } from '../../repertoire/repertoireTree.ts';
import {
  ContinueLineSession,
  fenAfterSans,
  isBookUci,
  pickStartPly,
  proposedContinuationSans,
  sampleRandomPath,
  voiceSpeedToRate,
  DEFAULT_VOICE_SPEED,
  continueLineRepeatSans,
  continueLineRepeatVerbalCue,
  continueLineRepeatSpeakOptions,
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

function fixedPath(sans: string[]) {
  const path = {
    id: 'fixed',
    sans: [...sans],
    fensBefore: [] as string[],
    choices: [] as never[],
  };
  const tmp = new Chess();
  for (const san of path.sans) {
    path.fensBefore.push(tmp.fen());
    tmp.move(san);
  }
  return path;
}

function playSan(session: ContinueLineSession, san: string): Move {
  const probe = new Chess(session.snapshot().currentFen);
  const move = probe.move(san);
  assert.ok(move, `expected legal SAN ${san}`);
  return move;
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
  it('user plays White only; Black replies auto from the fixed branch', () => {
    const rep = buildRepertoire(ITALIAN);
    const session = new ContinueLineSession();
    const path = fixedPath(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    session.start(rep, 'Italien', {
      path,
      startPly: 0,
      trainingSide: 'white',
    });
    const begun = session.beginRecitation();
    assert.deepEqual(begun.autoPlayedSans, []);
    assert.equal(session.snapshot().phase, 'reciting');

    let result = session.applyChessMove(playSan(session, 'e4'));
    assert.equal(result.kind, 'correct');
    assert.deepEqual(result.autoPlayedSans, ['e5']);
    assert.equal(session.snapshot().correctCount, 1);
    assert.deepEqual(session.snapshot().recitedSans, ['e4', 'e5']);

    result = session.applyChessMove(playSan(session, 'Nf3'));
    assert.equal(result.kind, 'correct');
    assert.deepEqual(result.autoPlayedSans, ['Nc6']);
    assert.equal(session.snapshot().correctCount, 2);

    result = session.applyChessMove(playSan(session, 'Bc4'));
    assert.equal(result.kind, 'correct');
    assert.deepEqual(result.autoPlayedSans, ['Bc5']);
    assert.equal(session.snapshot().phase, 'completed');
    assert.equal(session.snapshot().lineCompleted, true);
    assert.equal(session.snapshot().correctCount, 3);
    assert.equal(session.snapshot().recitedSans.length, 6);
  });

  it('user plays Black only; White is auto-played from the branch', () => {
    const rep = buildRepertoire(ITALIAN);
    const session = new ContinueLineSession();
    const path = fixedPath(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    session.start(rep, 'Italien', {
      path,
      startPly: 0,
      trainingSide: 'black',
    });
    const begun = session.beginRecitation();
    assert.deepEqual(begun.autoPlayedSans, ['e4']);
    assert.equal(session.snapshot().correctCount, 0);
    assert.deepEqual(session.snapshot().recitedSans, ['e4']);

    const result = session.applyChessMove(playSan(session, 'e5'));
    assert.equal(result.kind, 'correct');
    assert.deepEqual(result.autoPlayedSans, ['Nf3']);
    assert.equal(session.snapshot().correctCount, 1);
    assert.deepEqual(session.snapshot().recitedSans, ['e4', 'e5', 'Nf3']);
  });

  it('stops on first incorrect branch move and lists the expected reply', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const session = new ContinueLineSession();
    const path = fixedPath(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);

    session.start(rep, 'Test', { path, startPly: 4, trainingSide: 'white' });
    session.beginRecitation();

    const wrong = playSan(session, 'a3');
    const result = session.applyChessMove(wrong);
    assert.equal(result.kind, 'wrong');
    assert.equal(session.snapshot().phase, 'failed');
    assert.equal(session.snapshot().incorrectSan, 'a3');
    assert.deepEqual(session.snapshot().validAlternatives, ['Bc4']);
    assert.ok(session.snapshot().proposedContinuation.length >= 1);
  });

  it('rejects the other repertoire fork that is not on the selected branch', () => {
    const rep = buildRepertoire(TWO_BRANCHES);
    const session = new ContinueLineSession();
    const path = fixedPath(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    session.start(rep, 'Test', { path, startPly: 4, trainingSide: 'white' });
    session.beginRecitation();
    const result = session.applyChessMove(playSan(session, 'Bb5'));
    assert.equal(result.kind, 'wrong');
    assert.equal(session.snapshot().phase, 'failed');
    assert.deepEqual(session.snapshot().validAlternatives, ['Bc4']);
  });

  it('does not treat recognition failure as a repertoire error', () => {
    const rep = buildRepertoire(ITALIAN);
    const session = new ContinueLineSession();
    session.start(rep, 'Italien', {
      startPly: 0,
      rng: forceRng([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      trainingSide: 'white',
    });
    session.beginRecitation();
    const before = session.snapshot().correctCount;
    session.recordRecognitionFailure();
    assert.equal(session.snapshot().phase, 'reciting');
    assert.equal(session.snapshot().correctCount, before);
    assert.equal(session.snapshot().incorrectSan, null);
  });

  it('completes cleanly when the last user move finishes the branch', () => {
    const rep = buildRepertoire(ITALIAN);
    const session = new ContinueLineSession();
    const path = fixedPath(['e4', 'e5', 'Nf3']);
    session.start(rep, 'Test', { path, startPly: 2, trainingSide: 'white' });
    session.beginRecitation();
    const result = session.applyChessMove(playSan(session, 'Nf3'));
    assert.equal(result.kind, 'correct');
    assert.deepEqual(result.autoPlayedSans, []);
    assert.equal(session.snapshot().phase, 'completed');
    assert.equal(session.snapshot().correctCount, 1);
  });
});

describe('voiceSpeedToRate', () => {
  it('maps 1–10 into a usable speech rate band', () => {
    assert.ok(voiceSpeedToRate(1) < voiceSpeedToRate(DEFAULT_VOICE_SPEED));
    assert.ok(voiceSpeedToRate(10) > voiceSpeedToRate(DEFAULT_VOICE_SPEED));
    assert.equal(voiceSpeedToRate(5), voiceSpeedToRate(DEFAULT_VOICE_SPEED));
  });
});

describe('continueLineRepeatCue', () => {
  it('Répéter before progress uses the ligne de départ SANs only', () => {
    const preamble = ['e4', 'e5', 'Nf3', 'Nc6'];
    assert.deepEqual(
      continueLineRepeatSans({
        preambleSans: preamble,
        recitedSans: [],
        correctCount: 0,
      }),
      preamble,
    );
    const cue = continueLineRepeatVerbalCue({
      preambleSans: preamble,
      recitedSans: ['Bc4'],
      correctCount: 0,
      trainingSide: 'white',
    });
    assert.match(cue, /Continue la ligne \(Blancs\)/);
    assert.doesNotMatch(cue, /fou|Bc4/i);
  });

  it('Répéter after progress uses the position atteinte line', () => {
    const sans = continueLineRepeatSans({
      preambleSans: ['e4', 'e5'],
      recitedSans: ['Nf3', 'Nc6'],
      correctCount: 1,
    });
    assert.deepEqual(sans, ['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('speak options read the current slider value and always flush', () => {
    const slow = continueLineRepeatSpeakOptions(3);
    const fast = continueLineRepeatSpeakOptions(7);
    assert.equal(slow.flush, true);
    assert.equal(fast.flush, true);
    assert.equal(slow.rate, voiceSpeedToRate(3));
    assert.equal(fast.rate, voiceSpeedToRate(7));
    assert.ok(fast.rate > slow.rate);
  });

  it('Répéter helpers do not mutate session progression', () => {
    const rep = buildRepertoire(ITALIAN);
    const session = new ContinueLineSession();
    const path = fixedPath(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    session.start(rep, 'Italien', {
      path,
      startPly: 2,
      trainingSide: 'white',
    });
    session.beginRecitation();
    const before = session.snapshot();
    continueLineRepeatVerbalCue({
      preambleSans: before.preambleSans,
      recitedSans: before.recitedSans,
      correctCount: before.correctCount,
      trainingSide: before.trainingSide,
    });
    continueLineRepeatSpeakOptions(4);
    const after = session.snapshot();
    assert.equal(after.correctCount, before.correctCount);
    assert.equal(after.phase, before.phase);
    assert.deepEqual(after.preambleSans, before.preambleSans);
    assert.deepEqual(after.recitedSans, before.recitedSans);
    assert.equal(session.getPathId(), path.id);
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
});
