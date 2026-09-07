/**
 * Openings must see every nested branch via the shared GameTree.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRepertoire, movesForPosition } from '../repertoireTree.ts';
import {
  getAllTrainingLinesFromPgn,
  getValidRepertoireSansAtFen,
} from '../trainingLines.ts';

/**
 * Concept repertoire:
 * 1.e4
 *   1...c5 2.Nf3
 *     2...Nc6 3.d4 / 3.Bb5
 *     2...d6 3.d4
 *   1...e5 2.Nf3 2...Nc6 3.Bb5 / 3.Bc4
 */
const COMPLEX_REP = `[Event "ComplexRep"]
[White "W"]
[Black "B"]

1. e4 c5 (1... e5 2. Nf3 Nc6 3. Bb5 (3. Bc4)) 2. Nf3 Nc6 (2... d6 3. d4) 3. d4 (3. Bb5) *
`;

describe('getAllTrainingLinesFromPgn', () => {
  it('exposes every root→leaf path from a complex repertoire PGN', () => {
    const result = getAllTrainingLinesFromPgn(COMPLEX_REP);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const paths = result.lines.map((l) => l.sans.join(' ')).sort();
    assert.ok(paths.some((p) => p === 'e4 c5 Nf3 Nc6 d4'));
    assert.ok(paths.some((p) => p === 'e4 c5 Nf3 Nc6 Bb5'));
    assert.ok(paths.some((p) => p === 'e4 c5 Nf3 d6 d4'));
    assert.ok(paths.some((p) => p === 'e4 e5 Nf3 Nc6 Bb5'));
    assert.ok(paths.some((p) => p === 'e4 e5 Nf3 Nc6 Bc4'));
    assert.equal(result.lines.length, 5);
    assert.equal(result.stats.lineCount, 5);
    assert.equal(result.stats.leafCount, 5);
  });

  it('keeps multiple valid children at the same repertoire node', () => {
    const result = getAllTrainingLinesFromPgn(COMPLEX_REP);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    // After 1.e4 — both c5 and e5 are valid repertoire replies.
    const afterE4 = Object.values(result.game.nodesById).find(
      (n) => n.san === 'e4' && n.parentId == null,
    );
    assert.ok(afterE4);
    const replies = getValidRepertoireSansAtFen(result.game, afterE4!.fenAfter);
    assert.ok(replies.includes('c5'));
    assert.ok(replies.includes('e5'));

    // After 1.e4 c5 2.Nf3 — Nc6 and d6 both valid.
    const c5 = result.game.nodesById[afterE4!.childIds[0]!];
    assert.equal(c5?.san, 'c5');
    const nf3 = c5!.childIds
      .map((id) => result.game.nodesById[id])
      .find((n) => n?.san === 'Nf3');
    assert.ok(nf3);
    const afterNf3 = getValidRepertoireSansAtFen(result.game, nf3!.fenAfter);
    assert.deepEqual([...afterNf3].sort(), ['Nc6', 'd6']);
  });

  it('agrees with buildRepertoire on multi-choice positions', () => {
    const tree = getAllTrainingLinesFromPgn(COMPLEX_REP);
    assert.equal(tree.ok, true);
    if (!tree.ok) return;
    const rep = buildRepertoire(COMPLEX_REP);
    assert.ok(rep.errors.length === 0, rep.errors.map((e) => e.message).join('; '));

    const e4Node = Object.values(tree.game.nodesById).find(
      (n) => n.san === 'e4' && n.parentId == null,
    );
    assert.ok(e4Node);
    const treeSans = getValidRepertoireSansAtFen(tree.game, e4Node!.fenAfter).sort();
    const repSans = movesForPosition(rep, e4Node!.fenAfter)
      .map((m) => m.san)
      .sort();
    assert.deepEqual(treeSans, repSans);
  });
});
