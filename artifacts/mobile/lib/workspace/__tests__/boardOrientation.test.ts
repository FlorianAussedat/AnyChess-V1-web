import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDisplayFlip,
  flipOrientation,
  initialOrientationFromFen,
} from '../boardOrientation.ts';
import {
  createTreeFromFen,
  currentNode,
  goStart,
  playSan,
  returnToDivergence,
  sideFromFen,
  STANDARD_START_FEN,
} from '../variantTree.ts';
import { workspacePayloadFromFen } from '../buildWorkspacePayload.ts';

const BLACK_TO_MOVE =
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2';

test('black to move: initial orientation is black', () => {
  assert.equal(initialOrientationFromFen(BLACK_TO_MOVE), 'black');
  assert.equal(sideFromFen(BLACK_TO_MOVE), 'black');
});

test('imported FEN uses side-to-move as initial orientation', () => {
  const payload = workspacePayloadFromFen({
    fen: BLACK_TO_MOVE,
    title: 'FEN black',
  });
  assert.equal(payload.orientation, 'black');
  assert.equal(payload.initialFen, BLACK_TO_MOVE);
});

test('flip toggles orientation only', () => {
  assert.equal(flipOrientation('white'), 'black');
  assert.equal(flipOrientation('black'), 'white');
});

test('display flip keeps FEN, turn, node, branch and evaluation', () => {
  let tree = createTreeFromFen(STANDARD_START_FEN);
  tree = playSan(tree, 'e4')!;
  tree = goStart(tree);
  tree = playSan(tree, 'd4')!;
  const before = {
    fen: currentNode(tree).fen,
    side: sideFromFen(currentNode(tree).fen),
    nodeId: tree.currentNodeId,
    divergenceNodeId: tree.divergenceNodeId,
    evaluation: currentNode(tree).evaluation ?? null,
    orientation: 'white' as const,
  };
  const after = applyDisplayFlip(before);
  assert.equal(after.orientation, 'black');
  assert.equal(after.fen, before.fen);
  assert.equal(after.side, before.side);
  assert.equal(after.nodeId, before.nodeId);
  assert.equal(after.divergenceNodeId, before.divergenceNodeId);
  assert.equal(after.evaluation, before.evaluation);
});

test('navigation is preserved across a display flip', () => {
  let tree = createTreeFromFen(STANDARD_START_FEN);
  tree = playSan(tree, 'e4')!;
  tree = playSan(tree, 'e5')!;
  const nodeId = tree.currentNodeId;
  const ply = currentNode(tree).ply;
  applyDisplayFlip({
    orientation: 'white',
    nodeId,
    ply,
  });
  assert.equal(tree.currentNodeId, nodeId);
  assert.equal(currentNode(tree).ply, ply);
});

test('a variant remains after flipping the board', () => {
  let tree = createTreeFromFen(STANDARD_START_FEN);
  tree = playSan(tree, 'e4')!;
  tree = goStart(tree);
  tree = playSan(tree, 'c4')!;
  const variantId = tree.currentNodeId;
  const flipped = applyDisplayFlip({
    orientation: initialOrientationFromFen(STANDARD_START_FEN),
    variantId,
  });
  assert.equal(flipped.orientation, 'black');
  const back = returnToDivergence(tree);
  assert.ok(back.nodesById[variantId]);
  assert.equal(currentNode(tree).moveFromParent?.san, 'c4');
});
