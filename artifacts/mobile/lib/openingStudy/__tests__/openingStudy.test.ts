/**
 * Pedagogical opening reader: comments, branches, NAGs, SAN in comments, return-to-course.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePgn } from '../../repertoire/pgnParser.ts';
import { parseReaderPgn } from '../../gameReader/parseReaderPgn.ts';
import {
  annotatePlayableCommentTokens,
  beginCommentExploration,
  combinedCommentText,
  createOpeningStudyState,
  englishSanGuess,
  formatNags,
  nagLabel,
  returnToCourse,
  selectStudyBranch,
  studyGoEnd,
  studyGoNext,
  studyGoPrev,
  studyGoStart,
  tokenizeCommentSans,
  tryPlaySanSequence,
} from '../index.ts';

const BRANCHED = `[Event "Study"]
[White "W"]
[Black "B"]

1. e4 {after e4} e5 2. Nf3 {main} (2. Nc3 {vienna} g6 {black fianchetto} {2.d3 g6 is also possible.}) 2... d5 *`;

describe('PGN comments before/after and glyphs', () => {
  it('keeps commentBefore, commentAfter, and ! as NAG', () => {
    const games = parsePgn('{intro} 1. e4! {good} e5 $2 *');
    const root = games[0]!.root!;
    assert.equal(root.commentBefore, 'intro');
    assert.equal(root.comment, 'good');
    assert.ok(root.nags.includes('$1'));
    assert.ok(root.next?.nags.includes('$2'));
  });
});

describe('opening study navigation', () => {
  it('shows a branch picker when two continuations exist and next does not auto-pick', () => {
    const parsed = parseReaderPgn(BRANCHED);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    let state = createOpeningStudyState(parsed.game);
    state = studyGoNext(state); // e4
    state = studyGoNext(state); // e5
    const before = state.currentNodeId;
    state = studyGoNext(state);
    assert.equal(state.currentNodeId, before);
    assert.ok(state.pendingChoices && state.pendingChoices.length >= 2);
    const main = state.pendingChoices.find((c) => c.isMain);
    const side = state.pendingChoices.find((c) => !c.isMain);
    assert.ok(main);
    assert.ok(side);
    assert.equal(main!.san, 'Nf3');
    assert.equal(side!.san, 'Nc3');
  });

  it('shows the comment of the current node only', () => {
    const parsed = parseReaderPgn(BRANCHED);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    let state = createOpeningStudyState(parsed.game);
    assert.equal(combinedCommentText(state), '');
    state = studyGoNext(state);
    assert.match(combinedCommentText(state), /after e4/);
    state = studyGoNext(state);
    assert.doesNotMatch(combinedCommentText(state), /after e4/);
  });

  it('empty comment is an explicit empty string, never the previous move', () => {
    const parsed = parseReaderPgn('1. e4 {only first} e5 2. Nf3 *');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    let state = createOpeningStudyState(parsed.game);
    state = studyGoNext(state);
    assert.match(combinedCommentText(state), /only first/);
    state = studyGoNext(state);
    assert.equal(combinedCommentText(state), '');
  });

  it('start / prev / next / end stay on the chosen branch', () => {
    const parsed = parseReaderPgn(BRANCHED);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    let state = createOpeningStudyState(parsed.game);
    state = studyGoNext(state);
    state = studyGoNext(state);
    state = studyGoNext(state);
    const vienna = state.pendingChoices!.find((c) => c.san === 'Nc3')!;
    state = selectStudyBranch(state, vienna.nodeId);
    assert.equal(state.game.nodesById[state.currentNodeId!]!.san, 'Nc3');
    state = studyGoEnd(state);
    assert.equal(state.game.nodesById[state.currentNodeId!]!.san, 'g6');
    state = studyGoStart(state);
    assert.equal(state.currentNodeId, null);
    state = studyGoNext(state);
    state = studyGoPrev(state);
    assert.equal(state.currentNodeId, null);
  });
});

describe('NAG display', () => {
  it('maps standard NAGs to readable glyphs without dropping the original', () => {
    assert.equal(nagLabel('$1'), '!');
    assert.equal(nagLabel('$3'), '!!');
    assert.equal(nagLabel('$99'), '$99');
    assert.equal(formatNags(['$1', '$2']), '!?');
  });
});

describe('comment SAN detection', () => {
  it('detects English, French, castling, captures and checks', () => {
    const text = 'Try Nf3, Cf3, Bb5, Fb5, Qxd4+, Dxd4+, Rxe6, Txe6, O-O, 0-0-0, ...d5, exd5, Bxh7+, Fxh7+.';
    const tokens = tokenizeCommentSans(text).filter((t) => t.kind === 'san');
    const joined = tokens.map((t) => t.text).join(' ');
    assert.match(joined, /Nf3/);
    assert.match(joined, /Cf3/);
    assert.match(joined, /Bb5/);
    assert.match(joined, /Fb5/);
    assert.match(joined, /Qxd4\+/);
    assert.match(joined, /Dxd4\+/);
    assert.match(joined, /O-O/);
    assert.match(joined, /0-0-0/);
    assert.match(joined, /d5/);
    assert.match(joined, /exd5/);
    assert.match(joined, /Bxh7\+/);
    assert.match(joined, /Fxh7\+/);
    assert.equal(englishSanGuess('Cf3'), 'Nf3');
    assert.equal(englishSanGuess('Dxd4+'), 'Qxd4+');
  });

  it('marks a legal mini-line playable and an illegal one not playable', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const legal = annotatePlayableCommentTokens('White may try h3, Bh6 and O-O-O.', start);
    // from black to-move after e4, h3 is illegal
    assert.ok(legal.some((t) => t.kind === 'san' && t.text.includes('h3') && !t.playable));

    const afterE4E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const ok = tryPlaySanSequence(afterE4E5, ['Nf3']);
    assert.ok(ok);
    const bad = tryPlaySanSequence(afterE4E5, ['Qxh8']);
    assert.equal(bad, null);

    const tokens = annotatePlayableCommentTokens('Nf3 and d4', afterE4E5);
    const nf3 = tokens.find((t) => t.kind === 'san' && t.text === 'Nf3');
    assert.equal(nf3?.playable, true);
  });

  it('does not invent a move for an ambiguous / illegal token', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const tokens = annotatePlayableCommentTokens('Maybe Nf4 here.', start);
    const nf4 = tokens.find((t) => t.kind === 'san' && t.text === 'Nf4');
    assert.ok(nf4);
    assert.equal(nf4!.playable, false);
  });
});

describe('return to course', () => {
  it('returns to the secondary branch, not the main line', () => {
    const parsed = parseReaderPgn(BRANCHED);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    let state = createOpeningStudyState(parsed.game);
    state = studyGoNext(state); // e4
    state = studyGoNext(state); // e5
    state = studyGoNext(state);
    const vienna = state.pendingChoices!.find((c) => c.san === 'Nc3')!;
    state = selectStudyBranch(state, vienna.nodeId);
    const anchor = state.currentNodeId;
    const startFen = state.game.nodesById[anchor!]!.fenBefore;
    const played = tryPlaySanSequence(startFen, ['d3', 'g6']);
    assert.ok(played);
    state = beginCommentExploration(state, played!.legalSans, played!.fenAfter, startFen);
    assert.ok(state.exploringSans);
    state = returnToCourse(state);
    assert.equal(state.currentNodeId, anchor);
    assert.equal(state.exploringSans, null);
    assert.equal(state.game.nodesById[state.currentNodeId!]!.san, 'Nc3');
  });

  it('returns to the main line when the comment was on the main line', () => {
    const parsed = parseReaderPgn(BRANCHED);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    let state = createOpeningStudyState(parsed.game);
    state = studyGoNext(state); // e4
    const anchor = state.currentNodeId;
    const startFen = state.game.nodesById[anchor!]!.fenBefore;
    const played = tryPlaySanSequence(startFen, ['d4']);
    assert.ok(played);
    state = beginCommentExploration(state, played!.legalSans, played!.fenAfter, startFen);
    state = returnToCourse(state);
    assert.equal(state.currentNodeId, anchor);
    assert.equal(state.game.nodesById[state.currentNodeId!]!.san, 'e4');
  });
});
