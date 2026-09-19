/**
 * Editor ↔ AnyLyseur bridge: analysed SAN path, graft, create-study session.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { Chess } from 'chess.js';
import {
  createGameReaderState,
  emptyReaderGame,
  EXPLORATION_ORIGIN_START,
  playMoveOnReader,
} from '../../gameReader/index.ts';
import {
  createEmptyEditorSession,
  editorCurrentFen,
  editorCurrentNode,
  editorExportPgn,
  editorGoParent,
  editorGraftSans,
} from '../openingEditorState.ts';
import {
  analyzedLineSans,
  createOpeningStudySession,
  graftAnalyzedLineOntoParkedEditor,
  nodePathSans,
} from '../openingEditorAnalyzer.ts';
import {
  __resetParkedOpeningEditorForTests,
  setParkedOpeningEditor,
  takeParkedOpeningEditor,
} from '../parkedOpeningEditor.ts';

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

beforeEach(() => {
  __resetParkedOpeningEditorForTests();
});

afterEach(() => {
  __resetParkedOpeningEditorForTests();
});

function playUci(state: ReturnType<typeof createGameReaderState>, from: string, to: string) {
  return playMoveOnReader(state, from, to);
}

describe('nodePathSans', () => {
  it('returns the SAN sequence from origin to the cursor without duplicating the origin', () => {
    let state = createGameReaderState(emptyReaderGame(), null);
    state = playUci(state, 'e2', 'e4');
    state = playUci(state, 'e7', 'e5');
    state = playUci(state, 'g1', 'f3');
    assert.deepEqual(
      nodePathSans(state.game, EXPLORATION_ORIGIN_START, state.currentNodeId),
      ['e4', 'e5', 'Nf3'],
    );
    assert.deepEqual(
      analyzedLineSans({
        game: state.game,
        explorationOriginNodeId: EXPLORATION_ORIGIN_START,
        currentNodeId: state.currentNodeId,
      }),
      ['e4', 'e5', 'Nf3'],
    );
    assert.deepEqual(
      nodePathSans(state.game, EXPLORATION_ORIGIN_START, null),
      [],
    );
  });
});

describe('graft analysed line onto parked editor', () => {
  it('keeps unsaved comments and adds only the new branch', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    session = editorGraftSans(session, ['e4']);
    const originId = session.snapshot.currentNodeId;
    session = {
      ...session,
      snapshot: {
        ...session.snapshot,
        game: {
          ...session.snapshot.game,
          nodesById: {
            ...session.snapshot.game.nodesById,
            [originId!]: {
              ...session.snapshot.game.nodesById[originId!]!,
              comment: 'unsaved note',
            },
          },
        },
      },
      dirty: true,
    };

    setParkedOpeningEditor({
      session,
      commentDraft: 'unsaved note',
      side: 'white',
      originNodeId: originId,
      kind: 'analyze-return',
    });

    let analyzer = createGameReaderState(emptyReaderGame(AFTER_E4), null);
    analyzer = playUci(analyzer, 'e7', 'e5');
    analyzer = playUci(analyzer, 'g1', 'f3');

    const parked = graftAnalyzedLineOntoParkedEditor(
      analyzer.game,
      EXPLORATION_ORIGIN_START,
      analyzer.currentNodeId,
    );
    assert.ok(parked);
    assert.equal(parked!.session.snapshot.game.nodesById[originId!]?.comment, 'unsaved note');
    assert.equal(editorCurrentNode(parked!.session)?.san, 'Nf3');
    const pgn = editorExportPgn(parked!.session);
    assert.match(pgn, /1\. e4 \{unsaved note\} e5 2\. Nf3/);

    const again = graftAnalyzedLineOntoParkedEditor(
      analyzer.game,
      EXPLORATION_ORIGIN_START,
      analyzer.currentNodeId,
      parked,
    );
    const nf3Count = Object.values(again!.session.snapshot.game.nodesById).filter(
      (n) => n.san === 'Nf3',
    ).length;
    assert.equal(nf3Count, 1);
  });

  it('restores the parked session by file id', () => {
    const session = createEmptyEditorSession({
      folderId: 'f1',
      displayName: 'X',
      fileId: 'pgn_1',
    });
    setParkedOpeningEditor({
      session,
      commentDraft: 'draft',
      side: 'black',
      originNodeId: null,
      kind: 'analyze-return',
    });
    assert.equal(takeParkedOpeningEditor({ fileId: 'other' }), null);
    const taken = takeParkedOpeningEditor({ fileId: 'pgn_1' });
    assert.ok(taken);
    assert.equal(taken!.commentDraft, 'draft');
    assert.equal(taken!.side, 'black');
    assert.equal(takeParkedOpeningEditor({ fileId: 'pgn_1' }), null);
  });
});

describe('createOpeningStudySession', () => {
  it('keeps the line from the start of the game', () => {
    const session = createOpeningStudySession({
      folderId: 'w',
      displayName: 'Italian',
      initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      sans: ['e4', 'e5', 'Nf3'],
    });
    assert.equal(editorCurrentNode(session)?.san, 'Nf3');
    assert.match(editorExportPgn(session), /1\. e4 e5 2\. Nf3/);
  });

  it('starts from the current FEN and preserves the side to move', () => {
    const session = createOpeningStudySession({
      folderId: 'w',
      displayName: 'After e4',
      initialFen: AFTER_E4,
      sans: ['c5'],
    });
    assert.equal(editorCurrentFen(session).split(' ')[1], 'w');
    const pgn = editorExportPgn(session);
    assert.match(pgn, /\[SetUp "1"\]/);
    assert.match(pgn, /\[FEN "/);
    assert.match(pgn, /1\.\.\. c5/);
    const chess = new Chess(AFTER_E4);
    assert.equal(chess.turn(), 'b');
    chess.move('c5');
    assert.equal(chess.turn(), 'w');
  });
});

describe('playMoveOnReader knight + side to move', () => {
  it('opens from start FEN (White to move), plays Nf3, then grafts that ply into an empty editor', () => {
    let analyzer = createGameReaderState(emptyReaderGame(), null);
    assert.equal(analyzer.currentFen.split(' ')[1], 'w');
    analyzer = playUci(analyzer, 'g1', 'f3');
    assert.equal(analyzer.currentSan, 'Nf3');

    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Start' });
    setParkedOpeningEditor({
      session,
      commentDraft: '',
      side: 'white',
      originNodeId: null,
      kind: 'analyze-return',
    });
    const parked = graftAnalyzedLineOntoParkedEditor(
      analyzer.game,
      EXPLORATION_ORIGIN_START,
      analyzer.currentNodeId,
    );
    assert.ok(parked);
    assert.equal(editorCurrentNode(parked!.session)?.san, 'Nf3');
    assert.match(editorExportPgn(parked!.session), /1\. Nf3/);
  });

  it('plays g1-f3 from the start position (White to move) and records Nf3', () => {
    let state = createGameReaderState(emptyReaderGame(), null);
    state = playUci(state, 'g1', 'f3');
    assert.equal(state.currentSan, 'Nf3');
    assert.equal(state.game.nodesById[state.currentNodeId!]?.from, 'g1');
    assert.equal(state.game.nodesById[state.currentNodeId!]?.to, 'f3');
    assert.equal(state.currentFen.split(' ')[1], 'b');
  });

  it('plays g8-f6 from a FEN with Black to move', () => {
    let state = createGameReaderState(emptyReaderGame(AFTER_E4), null);
    const ignored = playUci(state, 'g1', 'f3');
    assert.equal(ignored.currentNodeId, state.currentNodeId);
    state = playUci(state, 'g8', 'f6');
    assert.equal(state.currentSan, 'Nf6');
    assert.equal(state.currentFen.split(' ')[1], 'w');
  });

  it('opens from a FEN with Black to move, plays Nf6, then grafts onto the editor node after e4', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Alekhine' });
    session = editorGraftSans(session, ['e4']);
    setParkedOpeningEditor({
      session,
      commentDraft: '',
      side: 'black',
      originNodeId: session.snapshot.currentNodeId,
      kind: 'analyze-return',
    });
    let analyzer = createGameReaderState(emptyReaderGame(AFTER_E4), null);
    assert.equal(analyzer.currentFen.split(' ')[1], 'b');
    analyzer = playUci(analyzer, 'g8', 'f6');
    assert.equal(analyzer.currentSan, 'Nf6');
    const parked = graftAnalyzedLineOntoParkedEditor(
      analyzer.game,
      EXPLORATION_ORIGIN_START,
      analyzer.currentNodeId,
    );
    assert.ok(parked);
    assert.equal(editorCurrentNode(parked!.session)?.san, 'Nf6');
    assert.match(editorExportPgn(parked!.session), /1\. e4 Nf6/);
  });
});

describe('graft several analysed plies onto an existing editor node', () => {
  it('reuses e5 and only appends the new tail, landing on the last grafted node', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    session = editorGraftSans(session, ['e4', 'e5']);
    const e5Id = session.snapshot.currentNodeId;
    session = editorGoParent(session);
    assert.equal(editorCurrentNode(session)?.san, 'e4');

    let analyzer = createGameReaderState(emptyReaderGame(AFTER_E4), null);
    analyzer = playUci(analyzer, 'e7', 'e5');
    analyzer = playUci(analyzer, 'g1', 'f3');
    analyzer = playUci(analyzer, 'b8', 'c6');
    analyzer = playUci(analyzer, 'f1', 'b5');
    analyzer = playUci(analyzer, 'a7', 'a6');
    assert.deepEqual(
      analyzedLineSans({
        game: analyzer.game,
        explorationOriginNodeId: EXPLORATION_ORIGIN_START,
        currentNodeId: analyzer.currentNodeId,
      }),
      ['e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
    );

    setParkedOpeningEditor({
      session,
      commentDraft: '',
      side: 'white',
      originNodeId: session.snapshot.currentNodeId,
      kind: 'analyze-return',
    });
    const parked = graftAnalyzedLineOntoParkedEditor(
      analyzer.game,
      EXPLORATION_ORIGIN_START,
      analyzer.currentNodeId,
    );
    assert.ok(parked);
    assert.equal(parked!.session.snapshot.game.nodesById[e5Id!]?.id, e5Id);
    assert.equal(parked!.session.snapshot.game.nodesById[e5Id!]?.san, 'e5');
    assert.equal(editorCurrentNode(parked!.session)?.san, 'a6');
    const pgn = editorExportPgn(parked!.session);
    assert.match(pgn, /1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6/);
    const nf3Count = Object.values(parked!.session.snapshot.game.nodesById).filter(
      (n) => n.san === 'Nf3',
    ).length;
    assert.equal(nf3Count, 1);
    const e5Count = Object.values(parked!.session.snapshot.game.nodesById).filter(
      (n) => n.san === 'e5',
    ).length;
    assert.equal(e5Count, 1);
  });
});
