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
