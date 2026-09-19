/**
 * Opening Mode « Analyser la partie » must copy comments/NAGs from the played
 * PGN branch into the PGN the classic analyzer parses — not from the FEN DAG.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { GameLibraryStore } from '../../gameLibrary/GameLibraryStore.ts';
import { importPgnGames } from '../../gameLibrary/importPgnGames.ts';
import { openPgnInAnalyzer } from '../../gameLibrary/openPgnInAnalyzer.ts';
import { parseReaderPgn, readerGameFromImported } from '../../gameReader/parseReaderPgn.ts';
import { exportGamePgn } from '../../pgn/PgnExporter.ts';
import { exportPositionPgn } from '../../pgn/exportPositionPgn.ts';
import { buildRepertoire, movesForPosition, DEFAULT_FEN } from '../repertoireTree.ts';
import {
  annotationsForPlayedLine,
  exportOpeningPlayedPgn,
} from '../playedLineAnnotations.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

const COMMENTS_TEST_PGN = `[Event "Comments test"]
[Result "*"]

1. e4 {White occupies the centre.} c5
2. Nf3 {Development and preparation for d4.} Nc6
3. d4 {The Open Sicilian begins.} cxd4
4. Nxd4 {White recaptures and develops the knight.} g6
5. Nc3 Bg7
6. Be3 {White protects the d4-knight.} Nf6
7. Be2 O-O
8. O-O d5 {The thematic Accelerated Dragon break.} *
`;

const COMMENTS_TEST_SANS = [
  'e4',
  'c5',
  'Nf3',
  'Nc6',
  'd4',
  'cxd4',
  'Nxd4',
  'g6',
  'Nc3',
  'Bg7',
  'Be3',
  'Nf6',
  'Be2',
  'O-O',
  'O-O',
  'd5',
];

const TWO_BRANCH_PGN = `[Event "Two branches"]
[Result "*"]

1. e4 {Shared e4} c5 {Sicilian} (1... e5 {Open games} 2. Nf3 {Develop against e5} Nc6 3. Bb5 {Spanish}) 2. Nf3 {Open Sicilian prep} d6 {Najdorf structure} *
`;

const PREFIX_GAMES_PGN = `[Event "Dragon"]
[Result "*"]

1. e4 {Dragon e4} c5 {Dragon c5} 2. Nf3 {Dragon Nf3} Nc6 {Dragon Nc6} 3. d4 {Open Sicilian d4} *

[Event "Najdorf"]
[Result "*"]

1. e4 {Najdorf e4} c5 {Najdorf c5} 2. Nf3 {Najdorf Nf3} d6 {Najdorf d6} 3. d4 {Najdorf d4} *
`;

const NO_COMMENT_PGN = `[Event "Silent"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 *
`;

function playSans(sans: readonly string[]): Move[] {
  const chess = new Chess();
  return sans.map((san) => chess.move(san) as Move);
}

function commentByPly(pgn: string): Map<number, string> {
  const parsed = parseReaderPgn(pgn);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.error);
  const map = new Map<number, string>();
  if (!parsed.ok) return map;
  for (const move of parsed.game.moves) {
    if (move.comment && move.comment.trim()) {
      map.set(move.ply, move.comment);
    }
  }
  return map;
}

function commentOnSan(pgn: string, san: string, occurrence = 0): string | undefined {
  const parsed = parseReaderPgn(pgn);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.error);
  if (!parsed.ok) return undefined;
  const hits = parsed.game.moves.filter((m) => m.san === san);
  return hits[occurrence]?.comment;
}

function nagsOnSan(pgn: string, san: string): string[] {
  const parsed = parseReaderPgn(pgn);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.error);
  if (!parsed.ok) return [];
  const move = parsed.game.moves.find((m) => m.san === san);
  return move?.nags ?? [];
}

function analyzerCommentsFromExport(pgn: string): Map<number, string> {
  return commentByPly(pgn);
}

describe('Test 1 — annotated main line reaches the analyzer', () => {
  it('keeps every comment on the played ply after Analyser la partie export', () => {
    const moves = playSans(COMMENTS_TEST_SANS);
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Comments test', Result: '*' },
      moves,
      sourcePgn: COMMENTS_TEST_PGN,
    });

    const comments = analyzerCommentsFromExport(exported);
    assert.match(commentOnSan(exported, 'e4') ?? '', /White occupies the centre/);
    assert.match(commentOnSan(exported, 'Nf3') ?? '', /Development and preparation for d4/);
    assert.match(commentOnSan(exported, 'd4') ?? '', /The Open Sicilian begins/);
    assert.match(commentOnSan(exported, 'Nxd4') ?? '', /White recaptures and develops the knight/);
    assert.match(commentOnSan(exported, 'Be3') ?? '', /White protects the d4-knight/);
    assert.match(commentOnSan(exported, 'd5') ?? '', /The thematic Accelerated Dragon break/);
    assert.equal(comments.size, 6);
  });

  it('openPgnInAnalyzer + reader still show those comments on the right moves', async () => {
    const moves = playSans(COMMENTS_TEST_SANS);
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Comments test', Result: '*' },
      moves,
      sourcePgn: COMMENTS_TEST_PGN,
    });
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const opened = await openPgnInAnalyzer({
      pgnText: exported,
      fileName: 'ouverture.pgn',
      displayName: 'Comments test',
      store,
    });
    assert.ok(opened);
    const reader = readerGameFromImported({
      id: opened!.game.id,
      fingerprint: opened!.game.fingerprint,
      headers: opened!.game.headers,
      initialFen: opened!.game.initialFen,
      moves: opened!.game.moves,
      hasVariations: opened!.game.hasVariations,
      rawPgn: opened!.game.source.rawPgn,
      source: opened!.game.source,
    });
    const e4 = reader.moves.find((m) => m.san === 'e4');
    const d5 = reader.moves.find((m) => m.san === 'd5');
    assert.match(e4?.comment ?? '', /White occupies the centre/);
    assert.match(d5?.comment ?? '', /Thematic Accelerated Dragon break/i);
  });
});

describe('Test 2 — several branches keep their own comments', () => {
  it('Sicilian branch does not leak Spanish comments', () => {
    const sicilian = ['e4', 'c5', 'Nf3', 'd6'];
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Two branches' },
      moves: playSans(sicilian),
      sourcePgn: TWO_BRANCH_PGN,
    });
    assert.match(commentOnSan(exported, 'e4') ?? '', /Shared e4/);
    assert.match(commentOnSan(exported, 'c5') ?? '', /Sicilian/);
    assert.match(commentOnSan(exported, 'Nf3') ?? '', /Open Sicilian prep/);
    assert.match(commentOnSan(exported, 'd6') ?? '', /Najdorf structure/);
    assert.doesNotMatch(exported, /Open games/);
    assert.doesNotMatch(exported, /Spanish/);
    assert.doesNotMatch(exported, /Develop against e5/);
  });

  it('Open-games branch does not leak Sicilian comments', () => {
    const open = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Two branches' },
      moves: playSans(open),
      sourcePgn: TWO_BRANCH_PGN,
    });
    assert.match(commentOnSan(exported, 'e4') ?? '', /Shared e4/);
    assert.match(commentOnSan(exported, 'e5') ?? '', /Open games/);
    assert.match(commentOnSan(exported, 'Nf3') ?? '', /Develop against e5/);
    assert.match(commentOnSan(exported, 'Bb5') ?? '', /Spanish/);
    assert.doesNotMatch(exported, /Sicilian/);
    assert.doesNotMatch(exported, /Najdorf structure/);
    assert.doesNotMatch(exported, /Open Sicilian prep/);
  });
});

describe('Test 3 — common prefix / transposition does not mix games', () => {
  it('Dragon line keeps Dragon comments even though Najdorf shares e4 c5 Nf3', () => {
    const dragon = ['e4', 'c5', 'Nf3', 'Nc6', 'd4'];
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Dragon' },
      moves: playSans(dragon),
      sourcePgn: PREFIX_GAMES_PGN,
    });
    assert.match(commentOnSan(exported, 'e4') ?? '', /Dragon e4/);
    assert.match(commentOnSan(exported, 'c5') ?? '', /Dragon c5/);
    assert.match(commentOnSan(exported, 'Nf3') ?? '', /Dragon Nf3/);
    assert.match(commentOnSan(exported, 'Nc6') ?? '', /Dragon Nc6/);
    assert.match(commentOnSan(exported, 'd4') ?? '', /Open Sicilian d4/);
    assert.doesNotMatch(exported, /Najdorf/);
  });

  it('Najdorf line keeps Najdorf comments', () => {
    const najdorf = ['e4', 'c5', 'Nf3', 'd6', 'd4'];
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Najdorf' },
      moves: playSans(najdorf),
      sourcePgn: PREFIX_GAMES_PGN,
    });
    assert.match(commentOnSan(exported, 'e4') ?? '', /Najdorf e4/);
    assert.match(commentOnSan(exported, 'd6') ?? '', /Najdorf d6/);
    assert.match(commentOnSan(exported, 'd4') ?? '', /Najdorf d4/);
    assert.doesNotMatch(exported, /Dragon/);
    assert.doesNotMatch(exported, /Open Sicilian d4/);
  });

  it('FEN DAG would mix the shared prefix; PGN walk does not', () => {
    const dag = buildRepertoire(PREFIX_GAMES_PGN);
    const startMoves = movesForPosition(dag, DEFAULT_FEN);
    const e4 = startMoves.find((m) => m.san === 'e4');
    // First ingested game wins the merged comment on the shared UCI.
    assert.match(e4?.comment ?? '', /Dragon e4/);

    const najdorfAnns = annotationsForPlayedLine(PREFIX_GAMES_PGN, [
      'e4',
      'c5',
      'Nf3',
      'd6',
      'd4',
    ]);
    const e4Ann = najdorfAnns.find((a) => a.ply === 0);
    assert.match(e4Ann?.comment ?? '', /Najdorf e4/);
  });
});

describe('Test 4 — line without comments stays silent', () => {
  it('does not invent empty or foreign comments', () => {
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Silent' },
      moves: playSans(['e4', 'e5', 'Nf3', 'Nc6']),
      sourcePgn: NO_COMMENT_PGN,
    });
    assert.doesNotMatch(exported, /\{/);
    assert.equal(annotationsForPlayedLine(NO_COMMENT_PGN, ['e4', 'e5', 'Nf3', 'Nc6']).length, 0);
  });
});

describe('Test 5 — classic analyzer regression', () => {
  it('parseReaderPgn of the original PGN still attaches comments to the right moves', () => {
    const parsed = parseReaderPgn(COMMENTS_TEST_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.match(parsed.game.moves[0]!.comment ?? '', /White occupies the centre/);
    assert.match(
      parsed.game.moves.find((m) => m.san === 'd5')?.comment ?? '',
      /Accelerated Dragon break/,
    );
    const imported = importPgnGames(COMMENTS_TEST_PGN);
    assert.equal(imported.imported.length, 1);
    assert.match(imported.imported[0]!.moves[0]!.comment ?? '', /White occupies the centre/);
  });

  it('Classic GameContext still exports SAN-only PGN (no opening source walk)', () => {
    const ctx = read('contexts/GameContext.tsx');
    assert.match(ctx, /exportGamePgn/);
    assert.doesNotMatch(ctx, /exportOpeningPlayedPgn|annotationsForPlayedLine|sourcePgn/);
    const classicScreen = read('components/ClassicGameScreen.tsx');
    assert.match(classicScreen, /openPgnInAnalyzer/);
    assert.match(classicScreen, /pgnText: exportedText \|\| exportPgn\(\)/);
  });
});

describe('Test 6 — Analyser la position stays position-only', () => {
  it('FEN export has the terminal side to move and no played-line comments', () => {
    const chess = new Chess();
    for (const san of COMMENTS_TEST_SANS) chess.move(san);
    const fen = chess.fen();
    assert.match(fen, / w /);
    const positionPgn = exportPositionPgn({
      fen,
      headers: { Event: 'Comments test' },
    });
    assert.match(positionPgn, /\[SetUp "1"\]/);
    assert.match(positionPgn, new RegExp(`\\[FEN "${fen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]`));
    assert.doesNotMatch(positionPgn, /1\. e4/);
    assert.doesNotMatch(positionPgn, /White occupies the centre/);
    assert.doesNotMatch(positionPgn, /Accelerated Dragon/);
    // Even if ply annotations were passed to the game exporter with no moves,
    // nothing from the line is injected.
    const emptyGame = exportGamePgn({
      headers: { Event: 'Comments test', SetUp: '1', FEN: fen, Result: '*' },
      moves: [],
      plyAnnotations: annotationsForPlayedLine(COMMENTS_TEST_PGN, COMMENTS_TEST_SANS),
    });
    assert.doesNotMatch(emptyGame, /White occupies the centre/);
    assert.doesNotMatch(emptyGame, /1\. e4/);
  });

  it('Opening « Analyser » CTA still sends the full exported game, not a FEN snapshot', () => {
    const screen = read('components/OpeningGameScreen.tsx');
    const ctx = read('contexts/OpeningGameContext.tsx');
    const play = read('app/openings/play.tsx');
    assert.match(screen, /onOpenInAnalyzer/);
    assert.match(screen, /pgnText: exportedText \|\| exportPgn\(\)/);
    assert.doesNotMatch(screen, /exportPositionPgn|openExercisePositionInAnalyzer|SetUp/);
    assert.match(ctx, /exportOpeningPlayedPgn/);
    assert.match(ctx, /sourcePgn/);
    assert.match(play, /sourcePgn=\{sourcePgn\}/);
    assert.match(play, /getFolderCombinedPgn/);
  });
});

describe('NAGs and theory-exit comments', () => {
  it('re-emits $NAG tokens from the played branch', () => {
    const pgn = `[Event "NAG"]\n\n1. e4 $1 {good} e5 $2 2. Nf3 *\n`;
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'NAG' },
      moves: playSans(['e4', 'e5', 'Nf3']),
      sourcePgn: pgn,
    });
    assert.ok(nagsOnSan(exported, 'e4').some((n) => n.includes('1')));
    assert.ok(nagsOnSan(exported, 'e5').some((n) => n.includes('2')));
    assert.match(commentOnSan(exported, 'e4') ?? '', /good/);
  });

  it('keeps the theory-exit comment in addition to repertoire comments', () => {
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Comments test' },
      moves: playSans(COMMENTS_TEST_SANS),
      sourcePgn: COMMENTS_TEST_PGN,
      commentAfterPly: {
        ply: COMMENTS_TEST_SANS.length - 1,
        text: 'Fin de la ligne théorique importée après 8... d5',
      },
    });
    assert.match(commentOnSan(exported, 'd5') ?? '', /Accelerated Dragon break/);
    assert.match(commentOnSan(exported, 'd5') ?? '', /Fin de la ligne théorique/);
  });

  it('does not attach later-line comments after an off-book deviation', () => {
    const exported = exportOpeningPlayedPgn({
      headers: { Event: 'Comments test' },
      moves: playSans(['e4', 'c5', 'Nf3', 'a6']),
      sourcePgn: COMMENTS_TEST_PGN,
    });
    assert.match(commentOnSan(exported, 'e4') ?? '', /White occupies the centre/);
    assert.match(commentOnSan(exported, 'Nf3') ?? '', /Development and preparation for d4/);
    assert.equal(commentOnSan(exported, 'a6'), undefined);
    assert.doesNotMatch(exported, /Open Sicilian begins/);
    assert.doesNotMatch(exported, /Accelerated Dragon/);
  });
});
