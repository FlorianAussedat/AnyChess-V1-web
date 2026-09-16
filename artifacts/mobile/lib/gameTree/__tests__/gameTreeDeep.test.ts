/**
 * Deep recursive PGN tree + round-trip + openings line enumeration tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createGameReaderState,
  goToNext,
  goToNode,
  goToPrevious,
  parseReaderPgn,
} from '../../gameReader/index.ts';
import { exportEnrichedPgn } from '../../analysis/exportEnrichedPgn.ts';
import {
  collectVariationBlock,
  buildNotationColumnRows,
} from '../../gameReader/notationColumns.ts';
import {
  gameTreeFingerprint,
  getAllRootToLeafLines,
  getChildSansAtFen,
  getGameTreeStats,
} from '../index.ts';

/**
 * Depth ≥ 4 branching:
 * Main: 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O
 * At 3: also 3...Nf6 4.O-O Be7 (and 4...Nxe4 nested under Nf6 line)
 * At 3: also 3.Bc4 Bc5 4.c3 (and under Bc4: 3...Nf6 4.d3 nested)
 */
const DEEP_PGN = `[Event "DeepTree"]
[White "W"]
[Black "B"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 (3... Nf6 4. O-O Be7 (4... Nxe4 5. d4)) 4. Ba4 Nf6 5. O-O *
`;

const OPENINGS_REP_PGN = `[Event "Rep"]
[White "W"]
[Black "B"]

1. e4 c5 (1... e5 2. Nf3 Nc6 3. Bb5 (3. Bc4)) 2. Nf3 Nc6 (2... d6 3. d4) 3. d4 (3. Bb5) *
`;

describe('getAllRootToLeafLines deep tree', () => {
  it('parses unbounded nested variations with expected stats', () => {
    const parsed = parseReaderPgn(DEEP_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const game = parsed.game;
    const stats = getGameTreeStats(game);
    const lines = getAllRootToLeafLines(game);

    assert.ok(stats.nodeCount >= 12, `nodes=${stats.nodeCount}`);
    assert.ok(stats.maxDepth >= 5, `depth=${stats.maxDepth}`);
    assert.equal(lines.length, stats.lineCount);
    assert.equal(stats.leafCount, lines.length);

    const sanPaths = lines.map((l) => l.sans.join(' '));
    assert.ok(
      sanPaths.some((p) => p.includes('Bb5') && p.includes('a6') && p.includes('Ba4')),
    );
    assert.ok(sanPaths.some((p) => p.includes('Nf6') && p.includes('Be7')));
    assert.ok(sanPaths.some((p) => p.includes('Nxe4')));

    // Every line has consistent fen chain length
    for (const line of lines) {
      assert.equal(line.sans.length, line.nodeIds.length);
      assert.equal(line.fensAfter.length, line.sans.length);
      assert.equal(line.startFen, game.initialFen);
    }
  });

  it('preserves parent/child links for nested forks', () => {
    const parsed = parseReaderPgn(DEEP_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const nxe4 = Object.values(parsed.game.nodesById).find((n) => n.san === 'Nxe4');
    assert.ok(nxe4);
    assert.ok(nxe4!.parentId);
    const parent = parsed.game.nodesById[nxe4!.parentId!]!;
    // Nxe4 is a side child of O-O (sibling of Be7)
    assert.ok(parent.childIds.includes(nxe4!.id));
    assert.ok(parent.childIds.length >= 2);
  });

  it('prev/next stays on deep branch after selecting nested node', () => {
    const parsed = parseReaderPgn(DEEP_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const nxe4 = Object.values(parsed.game.nodesById).find((n) => n.san === 'Nxe4');
    assert.ok(nxe4);
    let state = createGameReaderState(parsed.game, 0);
    state = goToNode(state, nxe4!.id);
    assert.equal(state.currentSan, 'Nxe4');
    state = goToPrevious(state);
    state = goToNext(state);
    assert.equal(state.currentSan, 'Nxe4');
    assert.equal(state.currentNodeId, nxe4!.id);
  });

  it('notation keeps nested variation blocks (not flattened)', () => {
    const parsed = parseReaderPgn(DEEP_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const rows = buildNotationColumnRows(parsed.game);
    const allBlocks = rows.flatMap((r) => r.variations);
    assert.ok(allBlocks.length >= 1);
    const hasNested = allBlocks.some((b) => b.nested.length > 0);
    assert.equal(hasNested, true);

    // Direct collectVariationBlock also carries nested
    const bb5 = Object.values(parsed.game.nodesById).find((n) => n.san === 'Bb5');
    assert.ok(bb5);
    const side = bb5!.childIds[1];
    if (side) {
      const block = collectVariationBlock(parsed.game, side, 1, bb5!.id);
      assert.ok(block);
      // Under 3...Nf6 4.O-O there should be nested 4...Nxe4
      const deep = block!.nested.length > 0 || block!.moves.some((m) => m.san === 'Nxe4');
      assert.ok(deep || block!.nested.some((n) => n.moves.some((m) => m.san === 'Nxe4')));
    }
  });

  it('round-trip serialize → parse preserves logical tree', () => {
    const parsed = parseReaderPgn(DEEP_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const exported = exportEnrichedPgn({
      game: parsed.game,
      includeEvals: false,
      includeBest: false,
    });
    const again = parseReaderPgn(exported);
    assert.equal(again.ok, true);
    if (!again.ok) return;

    const before = getGameTreeStats(parsed.game);
    const after = getGameTreeStats(again.game);
    assert.equal(after.lineCount, before.lineCount);
    assert.equal(after.leafCount, before.leafCount);
    assert.equal(after.nodeCount, before.nodeCount);

    const linesBefore = getAllRootToLeafLines(parsed.game)
      .map((l) => l.sans.join(' '))
      .sort();
    const linesAfter = getAllRootToLeafLines(again.game)
      .map((l) => l.sans.join(' '))
      .sort();
    assert.deepEqual(linesAfter, linesBefore);

    // Fingerprints may differ on ids but SAN/FEN structure must match
    assert.equal(
      gameTreeFingerprint(again.game).split('\n').length,
      gameTreeFingerprint(parsed.game).split('\n').length,
    );
  });
});

describe('openings repertoire paths from GameTree', () => {
  it('enumerates every imported branch including nested alternatives', () => {
    const parsed = parseReaderPgn(OPENINGS_REP_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const lines = getAllRootToLeafLines(parsed.game).map((l) => l.sans.join(' '));

    // Expected conceptual paths:
    // e4 c5 Nf3 Nc6 d4
    // e4 c5 Nf3 Nc6 Bb5
    // e4 c5 Nf3 d6 d4
    // e4 e5 Nf3 Nc6 Bb5
    // e4 e5 Nf3 Nc6 Bc4
    assert.ok(lines.some((p) => /e4 c5 Nf3 Nc6 d4/.test(p)), lines.join(' | '));
    assert.ok(lines.some((p) => /e4 c5 Nf3 Nc6 Bb5/.test(p)), lines.join(' | '));
    assert.ok(lines.some((p) => /e4 c5 Nf3 d6 d4/.test(p)), lines.join(' | '));
    assert.ok(lines.some((p) => /e4 e5 Nf3 Nc6 Bb5/.test(p)), lines.join(' | '));
    assert.ok(lines.some((p) => /e4 e5 Nf3 Nc6 Bc4/.test(p)), lines.join(' | '));
    assert.equal(lines.length, 5);
  });

  it('exposes multiple valid repertoire children at the same position', () => {
    const parsed = parseReaderPgn(OPENINGS_REP_PGN);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    // After 1.e4 c5 2.Nf3 — both Nc6 and d6 are valid children
    const afterC5 = Object.values(parsed.game.nodesById).find(
      (n) => n.san === 'c5',
    );
    assert.ok(afterC5);
    const nf3 = afterC5!.childIds
      .map((id) => parsed.game.nodesById[id])
      .find((n) => n?.san === 'Nf3');
    assert.ok(nf3);
    const children = getChildSansAtFen(parsed.game, nf3!.fenAfter);
    assert.ok(children.includes('Nc6'), children.join(','));
    assert.ok(children.includes('d6'), children.join(','));
  });
});
