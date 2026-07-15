/**
 * Comprehensive automated tests for the provider-agnostic chess voice parser.
 * No microphone / Web Speech API required — feed raw transcript strings.
 *
 * Run: pnpm test   (node --experimental-strip-types --test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  diagnoseVoiceTranscript,
  normalizeTranscript,
  parseAppCommand,
  parseChessVoice,
} from '../index.ts';

function parse(
  raw: string,
  fen?: string,
  mode: 'classic' | 'puzzle' | 'blind' | 'any' = 'classic',
) {
  const game = fen ? new Chess(fen) : new Chess();
  return parseChessVoice(raw, game, { mode });
}

function expectMove(raw: string, fen: string | undefined, san: string) {
  const r = parse(raw, fen);
  assert.equal(r.type, 'move', `expected move for «${raw}», got ${r.type}`);
  if (r.type === 'move') {
    assert.equal(r.move.san.replace(/[+#]/g, ''), san.replace(/[+#]/g, ''));
  }
}

describe('normalizeTranscript', () => {
  it('lowercases, trims, and collapses spaces', () => {
    assert.equal(normalizeTranscript('  Cavalier   F3  '), 'cavalier f3');
  });

  it('maps phonetic file + spoken rank to squares', () => {
    assert.equal(normalizeTranscript('effet trois'), 'f3');
    assert.equal(normalizeTranscript('eff three'), 'f3');
    assert.equal(normalizeTranscript('e quatre'), 'e4');
    assert.equal(normalizeTranscript('e four'), 'e4');
  });

  it('recovers "cavalier effet trois" → "cavalier f3"', () => {
    assert.equal(normalizeTranscript('cavalier effet trois'), 'cavalier f3');
  });

  it('normalizes castling phrases', () => {
    assert.match(normalizeTranscript('Petit roque'), /petit roque/);
    assert.match(normalizeTranscript('Castle kingside'), /petit roque/);
    assert.match(normalizeTranscript('Castle queenside'), /grand roque/);
    assert.match(normalizeTranscript('O-O-O'), /grand roque/);
  });

  it('maps takes/prend synonyms', () => {
    assert.match(normalizeTranscript('e takes d5'), /prend/);
    assert.match(normalizeTranscript('e prend d5'), /prend/);
  });
});

describe('pawn moves', () => {
  for (const [raw, san] of [
    ['e4', 'e4'],
    ['Pion e4', 'e4'],
    ['Pawn e4', 'e4'],
    ['e four', 'e4'],
    ['e quatre', 'e4'],
  ] as const) {
    it(`${raw} → ${san}`, () => expectMove(raw, undefined, san));
  }
});

describe('piece moves (French + English)', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  for (const raw of [
    'Cavalier f3',
    'Cf3',
    'Knight f3',
    'Nf3',
    'cavalier effet trois',
    'N f 3',
    'C f 3',
  ]) {
    it(`${raw} → Nf3`, () => expectMove(raw, fen, 'Nf3'));
  }
});

describe('captures', () => {
  const fenExd5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  for (const raw of [
    'exd5',
    'e x d5',
    'e prend d5',
    'e prends d5',
    'pion e prend d5',
    'e takes d5',
    'e takes on d5',
    'pawn e takes d5',
  ]) {
    it(`${raw} → exd5`, () => expectMove(raw, fenExd5, 'exd5'));
  }

  const fenNxe5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
  for (const raw of ['Cavalier prend e5', 'Cxe5', 'Knight takes e5', 'Nxe5']) {
    it(`${raw} → Nxe5`, () => expectMove(raw, fenNxe5, 'Nxe5'));
  }

  const fenRxa7 = '4k3/p7/8/8/8/8/8/R3K3 w - - 0 1';
  for (const raw of ['Tour prend a7', 'Txa7', 'Rook takes a7', 'Rxa7']) {
    it(`${raw} → Rxa7`, () => expectMove(raw, fenRxa7, 'Rxa7'));
  }
});

describe('bishop moves', () => {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  for (const raw of ['Fou b5', 'Fb5', 'Bishop b5', 'Bb5']) {
    it(`${raw} → Bb5`, () => expectMove(raw, fen, 'Bb5'));
  }
});

describe('castling', () => {
  const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  for (const raw of ['Petit roque', 'Castle kingside', 'O-O', '0-0']) {
    it(`${raw} → O-O`, () => expectMove(raw, fen, 'O-O'));
  }
  for (const raw of ['Grand roque', 'Castle queenside', 'O-O-O', '0-0-0']) {
    it(`${raw} → O-O-O`, () => expectMove(raw, fen, 'O-O-O'));
  }
});

describe('promotion', () => {
  // Black king off the e-file so e8 is vacant for promotion
  const fen = '3k4/4P3/8/8/8/8/8/4K3 w - - 0 1';
  for (const raw of ['e8', 'e8 dame', 'e8 queen', 'e8=D', 'e8=Q']) {
    it(`${raw} → e8=Q`, () => expectMove(raw, fen, 'e8=Q'));
  }
});

describe('check / checkmate suffixes ignored for parsing', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  for (const [raw, san] of [
    ['Nf3 échec', 'Nf3'],
    ['Knight f3 check', 'Nf3'],
    ['Nf3+', 'Nf3'],
  ] as const) {
    it(`${raw} still resolves`, () => expectMove(raw, fen, san));
  }
});

describe('disambiguation', () => {
  const fenAmbiguous = '4k3/8/8/8/8/2N3N1/8/4K3 w - - 0 1';

  it('resolves when only one knight can reach the square', () => {
    expectMove('Cavalier a4', fenAmbiguous, 'Na4');
    expectMove('Knight a4', fenAmbiguous, 'Na4');
  });

  it('returns ambiguous when two knights can reach the same square', () => {
    const r = parse('Cavalier e4', fenAmbiguous);
    assert.equal(r.type, 'ambiguous');
    if (r.type === 'ambiguous') {
      assert.ok(r.candidates.length >= 2);
    }
  });

  it('accepts file disambiguation', () => {
    expectMove('Cavalier c e4', fenAmbiguous, 'Nce4');
    expectMove('Knight c to e4', fenAmbiguous, 'Nce4');
    expectMove('Nce4', fenAmbiguous, 'Nce4');
    expectMove('Cavalier g e4', fenAmbiguous, 'Nge4');
  });

  it('accepts rook file disambiguation', () => {
    // Two white rooks on a1/h1; king elsewhere so e1 is free
    const fen = '4k3/8/8/8/8/8/4K3/R6R w - - 0 1';
    expectMove('Tour a e1', fen, 'Rae1');
    expectMove('Rook a to e1', fen, 'Rae1');
    expectMove('Rae1', fen, 'Rae1');
  });
});

describe('app commands', () => {
  for (const [raw, cmd] of [
    ['Annule', 'undo'],
    ['Annulé', 'undo'],
    ['Undo', 'undo'],
    ['Cancel', 'undo'],
  ] as const) {
    it(`${raw} → undo in classic`, () => {
      const r = parse(raw, undefined, 'classic');
      assert.equal(r.type, 'command');
      if (r.type === 'command') assert.equal(r.command, cmd);
    });
  }

  it('Solution only in puzzle mode', () => {
    const puzzle = parse('Solution', undefined, 'puzzle');
    assert.equal(puzzle.type, 'command');
    if (puzzle.type === 'command') assert.equal(puzzle.command, 'solution');

    const classic = parse('Solution', undefined, 'classic');
    assert.notEqual(classic.type, 'command');
  });

  for (const [raw, cmd] of [
    ['Répète', 'repeat'],
    ['Repeat', 'repeat'],
  ] as const) {
    it(`${raw} → repeat in classic`, () => {
      const r = parse(raw, undefined, 'classic');
      assert.equal(r.type, 'command');
      if (r.type === 'command') assert.equal(r.command, cmd);
    });
  }

  it('Répète la position → repeat_position in puzzle', () => {
    const r = parse('Répète la position', undefined, 'puzzle');
    assert.equal(r.type, 'command');
    if (r.type === 'command') assert.equal(r.command, 'repeat_position');
  });

  it('parseAppCommand respects mode allow-lists', () => {
    assert.equal(parseAppCommand('solution', 'classic'), null);
    assert.equal(parseAppCommand('solution', 'puzzle')?.command, 'solution');
    assert.equal(parseAppCommand('annuler', 'blind'), null);
  });
});

describe('illegal vs unrecognized', () => {
  it('returns illegal for a clear move that is not legal', () => {
    const r = parse('e5');
    assert.equal(r.type, 'illegal');
  });

  it('returns unrecognized for nonsense', () => {
    const r = parse('bonjour le monde');
    assert.equal(r.type, 'unrecognized');
  });
});

describe('recognition-like STT errors', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

  it('effet trois → pawn f3 when legal', () => {
    const r = parse('effet trois', fen);
    assert.equal(r.type, 'move');
    if (r.type === 'move') assert.equal(r.move.to, 'f3');
  });

  it('cavalier effet trois → Nf3', () => {
    expectMove('cavalier effet trois', fen, 'Nf3');
  });

  it('tour effet huit with unique legal rook to f8', () => {
    const rookFen = '4k3/8/8/8/8/8/8/4KR2 w - - 0 1';
    const r = parse('tour effet huit', rookFen);
    assert.equal(r.type, 'move');
    if (r.type === 'move') {
      assert.equal(r.move.to, 'f8');
      assert.equal(r.move.piece, 'r');
    }
  });

  it('e quatre / e four from start → e4', () => {
    expectMove('e quatre', undefined, 'e4');
    expectMove('e four', undefined, 'e4');
  });
});

describe('diagnoseVoiceTranscript', () => {
  it('returns normalized form and status for inspection', () => {
    const game = new Chess();
    const d = diagnoseVoiceTranscript('e quatre', game, { mode: 'classic' });
    assert.equal(d.normalizedTranscript, 'e4');
    assert.equal(d.statusLabel, 'legal');
    assert.equal(d.moveSan?.replace(/[+#]/g, ''), 'e4');
  });
});
