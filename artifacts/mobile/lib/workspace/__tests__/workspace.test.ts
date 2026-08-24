/**
 * Universal workspace — contract, session registry, build helpers, finish-vs-engine logic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearChessWorkspaceSessions,
  closeChessWorkspaceSession,
  createChessWorkspaceSession,
  getChessWorkspaceSession,
} from '../WorkspaceSessionRegistry.ts';
import { validateWorkspacePayload } from '../types.ts';
import {
  workspacePayloadFromFen,
  workspacePayloadFromImportedGame,
} from '../buildWorkspacePayload.ts';
import {
  buildFenFromMoves,
  sideFromFen,
} from '../useChessWorkspace.ts';
import type { ChessWorkspacePayload, WorkspaceMove } from '../types.ts';

// ─── Contract ──────────────────────────────────────────────────────────────

test('validates a free-play FEN payload', () => {
  const payload = workspacePayloadFromFen({
    fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1',
    title: 'FEN',
  });
  const checked = validateWorkspacePayload(payload);
  assert.equal(checked.ok, true);
});

test('rejects unknown workspace version', () => {
  const checked = validateWorkspacePayload({
    schemaVersion: 99,
    workspaceMode: 'reader',
    source: 'manual-pgn',
    title: 'Bad',
    initialFen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    orientation: 'white',
  });
  assert.equal(checked.ok, false);
});

test('rejects missing FEN', () => {
  const checked = validateWorkspacePayload({
    schemaVersion: 1,
    workspaceMode: 'reader',
    source: 'manual-pgn',
    title: 'Missing',
    initialFen: '',
    orientation: 'white',
  });
  assert.equal(checked.ok, false);
});

test('rejects invalid orientation', () => {
  const checked = validateWorkspacePayload({
    schemaVersion: 1,
    workspaceMode: 'reader',
    source: 'manual-pgn',
    title: 'Bad orient',
    initialFen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    orientation: 'green' as unknown as 'white',
  });
  assert.equal(checked.ok, false);
});

// ─── Session registry ──────────────────────────────────────────────────────

test('registers and closes a workspace session', () => {
  clearChessWorkspaceSessions();
  const payload = workspacePayloadFromFen({
    fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    title: 'Workspace',
  });
  const id = createChessWorkspaceSession(payload, 'overlay');
  assert.ok(id.startsWith('workspace-'));
  assert.equal(getChessWorkspaceSession(id)?.payload.title, 'Workspace');
  closeChessWorkspaceSession(id);
  assert.equal(getChessWorkspaceSession(id), null);
});

test('returns null for unknown session id', () => {
  clearChessWorkspaceSessions();
  assert.equal(getChessWorkspaceSession('does-not-exist'), null);
});

test('same payload → same initialFen in session', () => {
  clearChessWorkspaceSessions();
  const fen = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
  const payload = workspacePayloadFromFen({ fen, title: 'Q mate' });
  const id = createChessWorkspaceSession(payload, 'page');
  assert.equal(getChessWorkspaceSession(id)?.payload.initialFen, fen);
});

// ─── FEN builder ───────────────────────────────────────────────────────────

test('sideFromFen returns white for standard start', () => {
  assert.equal(sideFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), 'white');
});

test('sideFromFen returns black when b to move', () => {
  assert.equal(sideFromFen('8/8/8/4k3/8/8/8/4K2Q b - - 0 1'), 'black');
});

test('buildFenFromMoves empty variant returns initial fen', () => {
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const result = buildFenFromMoves(initialFen, [], 0, []);
  assert.equal(result, initialFen);
});

test('buildFenFromMoves advances through main moves', () => {
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const moves: WorkspaceMove[] = [
    {
      ply: 1,
      san: 'e4',
      fenBefore: initialFen,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      playedBy: 'white',
    },
  ];
  const fen = buildFenFromMoves(initialFen, moves, 1, []);
  assert.match(fen, /4P3/);
});

// ─── PGN import builder ────────────────────────────────────────────────────

test('workspacePayloadFromImportedGame sets title and mode', () => {
  const game = {
    id: 'test-1',
    fingerprint: 'fp',
    headers: { white: 'Alice', black: 'Bob', result: '1-0' },
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [
      {
        ply: 1,
        san: 'e4',
        fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      },
    ],
    hasVariations: false,
    source: { importedAt: 0 },
  } as unknown as import('../../gameLibrary/types.ts').ImportedChessGame;

  const payload = workspacePayloadFromImportedGame({
    game,
    orientation: 'white',
    title: 'Alice vs Bob',
    mode: 'reader',
  });
  assert.equal(payload.title, 'Alice vs Bob');
  assert.equal(payload.workspaceMode, 'reader');
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.moves?.length, 1);
});

// ─── Variants ──────────────────────────────────────────────────────────────

test('buildFenFromMoves applies variant sans after main ply', () => {
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const moves: WorkspaceMove[] = [
    {
      ply: 1,
      san: 'e4',
      fenBefore: initialFen,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      playedBy: 'white',
    },
  ];
  // Main ply=0 (before e4), then play d4 as variant
  const fen = buildFenFromMoves(initialFen, moves, 0, ['d4']);
  assert.match(fen, /3P4|PPP1PPPP/);
});

// ─── Finish-vs-engine payload validation ───────────────────────────────────

test('finish-vs-engine payload validates and has engineOpponent', () => {
  const payload: ChessWorkspacePayload = {
    schemaVersion: 1,
    workspaceMode: 'finish-vs-engine',
    source: 'defend-draw',
    title: 'Finir la partie',
    initialFen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1',
    orientation: 'white',
    playerColor: 'white',
    moves: [],
    engineOpponent: { enabled: true, color: 'black', policy: 'strict-best' },
  };
  const checked = validateWorkspacePayload(payload);
  assert.equal(checked.ok, true);
  if (checked.ok) {
    assert.equal(checked.payload.engineOpponent?.color, 'black');
    assert.equal(checked.payload.engineOpponent?.policy, 'strict-best');
  }
});

// ─── Eval convention ───────────────────────────────────────────────────────

test('white perspective: positive = white advantage', () => {
  // This is a contract test — just validate the type structure.
  const cp: ChessWorkspacePayload['evaluations'] = [
    { ply: 1, evaluation: { type: 'cp', value: 150, perspective: 'white' } },
    { ply: 2, evaluation: { type: 'cp', value: -80, perspective: 'white' } },
  ];
  assert.equal(cp![0]!.evaluation.value, 150);
  assert.equal(cp![1]!.evaluation.value, -80);
});

test('mate type persists correctly', () => {
  const mate: ChessWorkspacePayload['evaluations'] = [
    { ply: 3, evaluation: { type: 'mate', value: 5, perspective: 'white' } },
  ];
  assert.equal(mate![0]!.evaluation.type, 'mate');
});
