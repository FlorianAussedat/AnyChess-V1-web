import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  childChoices,
  createTreeFromFen,
  createTreeFromPayload,
  currentNode,
  goEnd,
  goNext,
  goPrev,
  goStart,
  isOnMainline,
  jumpToMainlinePly,
  lastMoveOnPath,
  mainlineMoves,
  playSan,
  playUci,
  returnToDivergence,
  selectNode,
  setNodeEvaluation,
  STANDARD_START_FEN,
} from '../variantTree.ts';
import type { ChessWorkspacePayload } from '../types.ts';

const START = STANDARD_START_FEN;

function payloadFromSans(sans: string[]): ChessWorkspacePayload {
  const chess = new Chess(START);
  const moves = sans.map((san, index) => {
    const fenBefore = chess.fen();
    const played = chess.move(san);
    if (!played) throw new Error(`bad san ${san}`);
    return {
      ply: index + 1,
      san: played.san,
      fenBefore,
      fenAfter: chess.fen(),
      playedBy: (index % 2 === 0 ? 'white' : 'black') as const,
    };
  });
  return {
    schemaVersion: 1,
    workspaceMode: 'reader',
    source: 'manual-pgn',
    title: 'Test',
    initialFen: START,
    orientation: 'white',
    moves,
  };
}

test('builds an immutable mainline from payload FENs', () => {
  const tree = createTreeFromPayload(payloadFromSans(['e4', 'e5', 'Nf3']));
  assert.equal(tree.mainlineNodeIds.length, 4);
  assert.equal(currentNode(tree).fen, START);
  assert.deepEqual(
    mainlineMoves(tree).map((m) => m.san),
    ['e4', 'e5', 'Nf3'],
  );
  const atEnd = goEnd(tree);
  assert.match(currentNode(atEnd).fen, /N/);
  assert.equal(currentNode(atEnd).isMainline, true);
});

test('first variant from a parent keeps the mainline child', () => {
  let tree = createTreeFromPayload(payloadFromSans(['e4', 'e5']));
  tree = playSan(tree, 'd4')!;
  assert.equal(currentNode(tree).moveFromParent?.san, 'd4');
  assert.equal(currentNode(tree).isMainline, false);
  const rootChoices = childChoices(tree, tree.rootNodeId);
  assert.equal(rootChoices.length, 2);
  assert.equal(rootChoices[0]?.san, 'e4');
  assert.equal(rootChoices[0]?.isMainline, true);
  assert.equal(rootChoices[1]?.san, 'd4');
  assert.equal(tree.nodesById[tree.mainlineNodeIds[1]!]!.moveFromParent?.san, 'e4');
});

test('second variant from the same parent keeps the first', () => {
  let tree = createTreeFromFen(START);
  tree = playSan(tree, 'e4')!;
  tree = goStart(tree);
  tree = playSan(tree, 'd4')!;
  tree = goStart(tree);
  tree = playSan(tree, 'Nf3')!;
  const choices = childChoices(tree, tree.rootNodeId);
  assert.equal(choices.length, 3);
  assert.deepEqual(
    choices.map((c) => c.san),
    ['e4', 'd4', 'Nf3'],
  );
  assert.equal(choices[0]?.isMainline, true);
  assert.equal(choices[1]?.label, 'variant1');
  assert.equal(choices[2]?.label, 'variant2');
});

test('first variant remains selectable after returning to mainline', () => {
  let tree = createTreeFromPayload(payloadFromSans(['e4']));
  tree = goStart(tree);
  tree = playSan(tree, 'd4')!;
  const variantId = tree.currentNodeId;
  tree = returnToDivergence(tree);
  assert.equal(tree.currentNodeId, tree.rootNodeId);
  assert.equal(tree.divergenceNodeId, null);
  const again = selectNode(tree, variantId)!;
  assert.equal(currentNode(again).moveFromParent?.san, 'd4');
  assert.ok(tree.nodesById[variantId]);
});

test('sub-variant can be created from a variant', () => {
  let tree = createTreeFromPayload(payloadFromSans(['e4', 'e5']));
  tree = goStart(tree);
  tree = playSan(tree, 'd4')!;
  assert.equal(currentNode(tree).isMainline, false);
  tree = playSan(tree, 'd5')!;
  assert.equal(currentNode(tree).ply, 2);
  assert.equal(currentNode(tree).isMainline, false);
  assert.equal(currentNode(tree).moveFromParent?.san, 'd5');
  const parent = tree.nodesById[currentNode(tree).parentId!]!;
  assert.equal(parent.moveFromParent?.san, 'd4');
});

test('selecting an old variant restores that node', () => {
  let tree = createTreeFromFen(START);
  tree = playSan(tree, 'e4')!;
  const e4 = tree.currentNodeId;
  tree = goStart(tree);
  tree = playSan(tree, 'c4')!;
  const selected = selectNode(tree, e4)!;
  assert.equal(currentNode(selected).moveFromParent?.san, 'e4');
});

test('returnToDivergence restores the exact fork node and mainline preference', () => {
  let tree = createTreeFromPayload(payloadFromSans(['e4', 'e5', 'Nf3']));
  tree = jumpToMainlinePly(tree, 1); // after e4
  tree = playSan(tree, 'c5')!;
  tree = playSan(tree, 'c3')!;
  assert.ok(tree.divergenceNodeId);
  const forkFen = tree.nodesById[tree.divergenceNodeId!]!.fen;
  const returned = returnToDivergence(tree);
  assert.equal(currentNode(returned).fen, forkFen);
  assert.equal(currentNode(returned).isMainline, true);
  const next = goNext(returned);
  assert.equal(currentNode(next).moveFromParent?.san, 'e5');
  assert.equal(currentNode(next).isMainline, true);
});

test('mainline nodes stay immutable when variants are added', () => {
  const original = createTreeFromPayload(payloadFromSans(['e4', 'e5']));
  const mainSans = mainlineMoves(original).map((m) => m.san);
  let tree = goStart(original);
  tree = playSan(tree, 'd4')!;
  tree = goStart(tree);
  tree = playSan(tree, 'c4')!;
  assert.deepEqual(mainlineMoves(tree).map((m) => m.san), mainSans);
  assert.equal(tree.nodesById[original.mainlineNodeIds[1]!]!.id, original.mainlineNodeIds[1]);
});

test('playing the same move reuses the existing child node', () => {
  let tree = createTreeFromFen(START);
  tree = playSan(tree, 'e4')!;
  const firstId = tree.currentNodeId;
  tree = goStart(tree);
  tree = playSan(tree, 'e4')!;
  assert.equal(tree.currentNodeId, firstId);
  assert.equal(childChoices(tree, tree.rootNodeId).length, 1);
});

test('evaluations stay attached to node ids, not ply numbers', () => {
  let tree = createTreeFromFen(START);
  tree = playSan(tree, 'e4')!;
  const e4Id = tree.currentNodeId;
  tree = setNodeEvaluation(tree, e4Id, { type: 'cp', value: 40, perspective: 'white', depth: 12 });
  tree = goStart(tree);
  tree = playSan(tree, 'd4')!;
  const d4Id = tree.currentNodeId;
  tree = setNodeEvaluation(tree, d4Id, { type: 'cp', value: 25, perspective: 'white', depth: 12 });
  assert.equal(tree.nodesById[e4Id]!.ply, tree.nodesById[d4Id]!.ply);
  assert.equal(tree.nodesById[e4Id]!.evaluation?.value, 40);
  assert.equal(tree.nodesById[d4Id]!.evaluation?.value, 25);
});

test('promotion creates a distinct child by SAN', () => {
  const fen = '8/4P3/8/8/8/8/8/4K2k w - - 0 1';
  let tree = createTreeFromFen(fen);
  tree = playUci(tree, 'e7', 'e8', 'q')!;
  assert.equal(currentNode(tree).moveFromParent?.san, 'e8=Q');
  tree = goPrev(tree);
  tree = playUci(tree, 'e7', 'e8', 'n')!;
  const choices = childChoices(tree, tree.rootNodeId);
  assert.equal(choices.length, 2);
  assert.deepEqual(
    choices.map((c) => c.san).sort(),
    ['e8=N', 'e8=Q'].sort(),
  );
});

test('castling is stored as a child SAN', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  let tree = createTreeFromFen(fen);
  tree = playSan(tree, 'O-O')!;
  assert.equal(currentNode(tree).moveFromParent?.san, 'O-O');
  tree = goPrev(tree);
  tree = playSan(tree, 'O-O-O')!;
  assert.equal(childChoices(tree, tree.rootNodeId).length, 2);
});

test('en passant is a legal branching move', () => {
  const fen = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
  let tree = createTreeFromFen(fen);
  tree = playSan(tree, 'exd6')!;
  assert.equal(currentNode(tree).moveFromParent?.san, 'exd6');
  assert.ok(lastMoveOnPath(tree));
});

test('navigation start/prev/next/end follows the preferred child', () => {
  let tree = createTreeFromPayload(payloadFromSans(['e4', 'e5', 'Nf3', 'Nc6']));
  tree = goNext(tree);
  assert.equal(currentNode(tree).moveFromParent?.san, 'e4');
  tree = goEnd(tree);
  assert.equal(currentNode(tree).moveFromParent?.san, 'Nc6');
  tree = goPrev(tree);
  assert.equal(currentNode(tree).moveFromParent?.san, 'Nf3');
  tree = goStart(tree);
  assert.equal(currentNode(tree).id, 'root');
  assert.equal(isOnMainline(tree), true);
});

test('illegal SAN is rejected without mutating the tree', () => {
  const tree = createTreeFromFen(START);
  assert.equal(playSan(tree, 'e5'), null);
  assert.equal(tree.currentNodeId, 'root');
});
