/**
 * Visual opening PGN editor: tree mutations, round-trip, library save.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { buildRepertoire } from '../../repertoire/repertoireTree.ts';
import {
  isFileEnabledForReview,
  isFileVisibleInLearning,
} from '../../repertoire/reviewActivation.ts';
import { parsePgn } from '../../repertoire/pgnParser.ts';
import { parseReaderPgn } from '../../gameReader/parseReaderPgn.ts';
import type { RepertoireFolder, StoredPgnFile } from '../../repertoire/storage/types.ts';
import { combinedCommentText, createOpeningStudyState, studyGoNext } from '../openingStudyState.ts';
import {
  createEmptyEditorSession,
  editorAppendMove,
  editorClearComment,
  editorCurrentNode,
  editorDeleteCurrentVariation,
  editorExportPgn,
  editorGoPrev,
  editorIsDirty,
  editorMarkSaved,
  editorSelectNode,
  editorSetComment,
  editorToggleNag,
  editorTrySan,
  editorUndo,
  loadEditorSessionFromPgn,
  preferredStudyTab,
  type OpeningEditorSession,
  type PlayEditorMoveResult,
} from '../openingEditorState.ts';

const SOURCE = `[Event "Study"]
[Site "Club"]
[White "W"]
[Black "B"]
[Result "*"]
[ECO "C50"]

{intro} 1. e4 {after e4} e5 2. Nf3! (2. Nc3 {vienna}) 2... Nc6 *`;

function play(
  session: OpeningEditorSession,
  san: string,
): { session: OpeningEditorSession; result: PlayEditorMoveResult } {
  const result = editorTrySan(session, san);
  assert.ok(result, `expected legal ${san}`);
  if (result.kind === 'confirm-variation') {
    return {
      result,
      session: editorAppendMove(session, result.move),
    };
  }
  return { result, session: result.session };
}

function mainSans(session: OpeningEditorSession): string[] {
  const sans: string[] = [];
  let id = session.snapshot.game.rootIds[0] ?? null;
  while (id) {
    const node = session.snapshot.game.nodesById[id];
    if (!node) break;
    sans.push(node.san);
    id = node.childIds[0] ?? null;
  }
  return sans;
}

function allLines(session: OpeningEditorSession): string[] {
  const out: string[] = [];
  const walk = (ids: string[], prefix: string[]) => {
    if (ids.length === 0) {
      out.push(prefix.join(' '));
      return;
    }
    for (const id of ids) {
      const node = session.snapshot.game.nodesById[id];
      if (!node) continue;
      walk(node.childIds, [...prefix, node.san]);
    }
  };
  walk(session.snapshot.game.rootIds, []);
  return out.sort();
}

describe('preferred study tab', () => {
  it('uses comments when text exists, otherwise notation', () => {
    assert.equal(preferredStudyTab('  hello  '), 'comments');
    assert.equal(preferredStudyTab(''), 'notation');
    assert.equal(preferredStudyTab('   '), 'notation');
  });

  it('follows the current node comment in the pedagogical reader', () => {
    const parsed = parseReaderPgn(SOURCE);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    let state = createOpeningStudyState(parsed.game);
    assert.equal(preferredStudyTab(combinedCommentText(state)), 'comments');
    state = studyGoNext(state); // e4
    assert.equal(preferredStudyTab(combinedCommentText(state)), 'comments');
    state = studyGoNext(state); // e5
    assert.equal(preferredStudyTab(combinedCommentText(state)), 'notation');
    state = studyGoNext(state); // Nf3
    assert.equal(preferredStudyTab(combinedCommentText(state)), 'notation');
  });
});

describe('opening editor tree', () => {
  it('creates a main line from the starting position', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    assert.equal(session.dirty, false);
    session = play(session, 'e4').session;
    session = play(session, 'e5').session;
    session = play(session, 'Nf3').session;
    assert.deepEqual(mainSans(session), ['e4', 'e5', 'Nf3']);
    assert.equal(editorCurrentNode(session)?.san, 'Nf3');
    assert.equal(session.dirty, true);
  });

  it('adds a variation after confirmation and does not duplicate it', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    session = play(session, 'e4').session;
    session = play(session, 'e5').session;
    session = play(session, 'Nf3').session;
    session = editorGoPrev(session);
    const first = editorTrySan(session, 'Nc3');
    assert.equal(first?.kind, 'confirm-variation');
    session = editorAppendMove(session, (first as { move: import('chess.js').Move }).move);
    assert.ok(allLines(session).includes('e4 e5 Nc3'));
    session = editorGoPrev(session);
    const again = editorTrySan(session, 'Nc3');
    assert.equal(again?.kind, 'follow');
    assert.equal(allLines(session).filter((line) => line === 'e4 e5 Nc3').length, 1);
  });

  it('creates a nested sub-variation', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    session = play(session, 'e4').session;
    session = play(session, 'e5').session;
    session = play(session, 'Nf3').session;
    session = editorGoPrev(session);
    session = play(session, 'Nc3').session;
    session = play(session, 'Nc6').session;
    session = editorGoPrev(session);
    const nested = editorTrySan(session, 'g6');
    assert.equal(nested?.kind, 'confirm-variation');
    session = editorAppendMove(session, (nested as { move: import('chess.js').Move }).move);
    const lines = allLines(session);
    assert.ok(lines.includes('e4 e5 Nc3 Nc6'));
    assert.ok(lines.includes('e4 e5 Nc3 g6'));
  });

  it('adds, edits and deletes a comment on the current move', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    session = play(session, 'e4').session;
    session = editorSetComment(session, '  bon coup  ');
    assert.equal(editorCurrentNode(session)?.comment, 'bon coup');
    session = editorSetComment(session, 'meilleur');
    assert.equal(editorCurrentNode(session)?.comment, 'meilleur');
    session = editorClearComment(session);
    assert.equal(editorCurrentNode(session)?.comment, undefined);
  });

  it('toggles a NAG glyph on the current move', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    session = play(session, 'e4').session;
    session = editorToggleNag(session, '!');
    assert.deepEqual(editorCurrentNode(session)?.nags, ['$1']);
    session = editorToggleNag(session, '$1');
    assert.equal(editorCurrentNode(session)?.nags, undefined);
  });

  it('deletes a side variation without touching the main line', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    session = play(session, 'e4').session;
    session = play(session, 'e5').session;
    session = play(session, 'Nf3').session;
    session = editorGoPrev(session);
    session = play(session, 'Nc3').session;
    const viennaId = session.snapshot.currentNodeId;
    session = editorDeleteCurrentVariation(session);
    assert.ok(!viennaId || !session.snapshot.game.nodesById[viennaId]);
    assert.deepEqual(mainSans(session), ['e4', 'e5', 'Nf3']);
  });

  it('undo restores a deleted comment', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'Italian' });
    session = play(session, 'e4').session;
    session = editorSetComment(session, 'keep');
    session = editorClearComment(session);
    session = editorUndo(session);
    assert.equal(editorCurrentNode(session)?.comment, 'keep');
  });
});

describe('opening PGN round-trip', () => {
  it('reimports headers, main line, variations, comments and NAGs', () => {
    const loaded = loadEditorSessionFromPgn({
      pgnText: SOURCE,
      folderId: 'f1',
      displayName: 'My study',
    });
    const e4 = Object.values(loaded.snapshot.game.nodesById).find((n) => n.san === 'e4')!;
    let session = editorSelectNode(loaded, e4.id);
    session = editorSetComment(session, 'after e4 — edited');
    session = editorGoPrev(session);
    session = play(session, 'e4').session;
    session = play(session, 'e5').session;
    const fork = editorTrySan(session, 'd4');
    assert.equal(fork?.kind, 'confirm-variation');
    session = editorAppendMove(session, (fork as { move: import('chess.js').Move }).move);

    const exported = editorExportPgn(session);
    assert.match(exported, /\[Event "Study"\]/);
    assert.match(exported, /\[White "W"\]/);
    assert.match(exported, /\[ECO "C50"\]/);
    assert.match(exported, /after e4 — edited/);
    assert.match(exported, /\$1/);
    assert.match(exported, /\(2\. Nc3/);

    const parsed = parsePgn(exported);
    const root = parsed[0]!.root!;
    assert.equal(parsed[0]!.headers.Event, 'Study');
    assert.equal(parsed[0]!.headers.ECO, 'C50');
    assert.equal(root.commentBefore, 'intro');
    assert.equal(root.comment, 'after e4 — edited');
    const nf3 = root.next?.next;
    assert.ok(nf3?.nags.includes('$1'));
    assert.ok(nf3?.variations.some((v) => v.san === 'Nc3'));
    assert.ok(nf3?.variations.some((v) => v.san === 'd4'));

    const reader = parseReaderPgn(exported, { allowEmptyMoves: true });
    assert.equal(reader.ok, true);
    if (!reader.ok) return;
    const reloaded = loadEditorSessionFromPgn({
      pgnText: exported,
      folderId: 'f1',
      displayName: 'My study',
    });
    assert.deepEqual(mainSans(reloaded), ['e4', 'e5', 'Nf3', 'Nc6']);
    const lines = allLines(reloaded);
    assert.ok(lines.includes('e4 e5 Nf3 Nc6'));
    assert.ok(lines.includes('e4 e5 Nc3'));
    assert.ok(lines.includes('e4 e5 d4'));
    const e4Again = Object.values(reloaded.snapshot.game.nodesById).find((n) => n.san === 'e4')!;
    assert.equal(e4Again.comment, 'after e4 — edited');
    assert.equal(e4Again.commentBefore, 'intro');
  });

  it('keeps a library display name distinct from the Event header', () => {
    let session = createEmptyEditorSession({
      folderId: 'folder_it',
      displayName: 'Mon italienne',
    });
    session = play(session, 'e4').session;
    session = play(session, 'e5').session;
    const pgn = editorExportPgn(session);
    const parsed = buildRepertoire(pgn);
    const file: StoredPgnFile = {
      id: 'pgn_1',
      folderId: 'folder_it',
      filename: 'italienne.pgn',
      displayName: 'Mon italienne',
      importedAt: '',
      pgnText: pgn,
      enabled: true,
      summary: {
        gameCount: parsed.headers.length,
        positionCount: parsed.positionCount,
        branchCount: parsed.branchCount,
        parseSucceeded: parsed.positionCount > 0,
        errors: parsed.errors,
        warnings: parsed.warnings,
      },
    };
    assert.equal(file.displayName, 'Mon italienne');
    assert.match(file.pgnText, /Event "AnyChess Opening Study"/);
    assert.notEqual(file.displayName, 'AnyChess Opening Study');
  });
});

describe('editor save reaches Learning and Review', () => {
  it('saved PGN is visible in learning and usable in review', () => {
    let session = createEmptyEditorSession({ folderId: 'w', displayName: 'Line' });
    session = play(session, 'e4').session;
    session = play(session, 'e5').session;
    session = play(session, 'Nf3').session;
    session = editorGoPrev(session);
    session = play(session, 'Nc3').session;
    const pgn = editorExportPgn(session);
    const parsed = buildRepertoire(pgn);
    const folder: RepertoireFolder = {
      id: 'w',
      name: 'Blancs',
      side: 'white',
      enabled: true,
      createdAt: '',
      updatedAt: '',
    };
    const file: StoredPgnFile = {
      id: 'pgn_1',
      folderId: 'w',
      filename: 'line.pgn',
      displayName: 'Line',
      importedAt: '',
      pgnText: pgn,
      enabled: true,
      summary: {
        gameCount: parsed.headers.length,
        positionCount: parsed.positionCount,
        branchCount: parsed.branchCount,
        parseSucceeded: parsed.positionCount > 0,
        errors: parsed.errors,
        warnings: parsed.warnings,
      },
    };
    assert.equal(isFileVisibleInLearning(file), true);
    assert.equal(isFileEnabledForReview(folder, file), true);
    assert.ok((parsed.trainingPaths?.length ?? 0) >= 2);
    session = editorMarkSaved(session, file.id);
    assert.equal(editorIsDirty(session), false);
  });

  it('marks the session dirty until save, including unsaved edits', () => {
    let session = createEmptyEditorSession({ folderId: 'f1', displayName: 'X' });
    assert.equal(editorIsDirty(session), false);
    session = play(session, 'e4').session;
    assert.equal(editorIsDirty(session), true);
    session = editorMarkSaved(session, 'pgn_1');
    assert.equal(editorIsDirty(session), false);
    session = editorSetComment(session, 'note');
    assert.equal(editorIsDirty(session), true);
    session = editorUndo(session);
    assert.equal(editorIsDirty(session), false);
  });
});

describe('legal move helper', () => {
  it('rejects an illegal SAN from the current node', () => {
    const session = createEmptyEditorSession({ folderId: 'f1', displayName: 'X' });
    assert.equal(editorTrySan(session, 'Qxh8'), null);
    const chess = new Chess();
    assert.equal(chess.move('e4')?.san, 'e4');
  });
});
