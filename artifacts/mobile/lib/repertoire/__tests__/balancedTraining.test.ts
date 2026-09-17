import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRepertoire } from '../repertoireTree.ts';
import { sampleRandomPath } from '../../continueLine/RepertoireBranchSelector.ts';
import { pickMixedLine } from '../MixedRepertoireTraining.ts';
import { selectedPgnImports } from '../joinSelectedPgnSlices.ts';
import { indexPgnGamesLight } from '../../gameLibrary/indexPgnGamesLight.ts';
const branching = '1. e4 (1. d4 d5) e5 (1... c5 2. Nf3 (2. Nc3)) 2. Nf3 *';
describe('balanced training and imports', () => {
  it('gives each nested leaf an equal slot', () => {
    const rep = buildRepertoire(branching);
    assert.equal(rep.trainingPaths?.length, 4);
    assert.equal(new Set([0.01, 0.26, 0.51, 0.76].map(v => sampleRandomPath(rep, { rng: () => v })!.id)).size, 4);
  });
  it('cycles through all branches even with a stuck RNG', () => {
    const rep = buildRepertoire(branching);
    let recent: string[] = [];
    const counts = new Map<string, number>();
    for (let i = 0; i < 40; i++) {
      const p = sampleRandomPath(rep, { rng: () => 0, recentPathIds: recent })!;
      assert.notEqual(p.id, recent[0]);
      counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
      recent = [p.id, ...recent.filter(id => id !== p.id)];
    }
    assert.deepEqual([...counts.values()], [10, 10, 10, 10]);
  });
  it('weights mixed folders by their complete lines', () => {
    const folder = (id: string) => ({ id, name: id, side: 'white' as const, createdAt: '', updatedAt: '' });
    const entries = [{ folder: folder('a'), repertoire: buildRepertoire(branching) }, { folder: folder('b'), repertoire: buildRepertoire('1. c4 e5 *') }];
    const counts: Record<string, number> = {};
    for (const rng of [0.01, 0.21, 0.41, 0.61, 0.81]) {
      const p = pickMixedLine(entries, { rng: () => rng })!;
      counts[p.folderId] = (counts[p.folderId] ?? 0) + 1;
    }
    assert.deepEqual(counts, { a: 4, b: 1 });
  });
  it('preserves authored paths across transpositions', () => {
    const rep = buildRepertoire('[Event "A"]\n\n1. Nf3 Nf6 2. g3 g6 3. Bg2 *\n\n[Event "B"]\n\n1. g3 g6 2. Nf3 Nf6 3. d3 *');
    assert.deepEqual(new Set(rep.trainingPaths!.map(p => p.sans.join(' '))), new Set(['Nf3 Nf6 g3 g6 Bg2', 'g3 g6 Nf3 Nf6 d3']));
  });
  it('keeps each title, source name and secondary variations on import', () => {
    const text = '[White "Italian h6"]\n\n1. e4 e5 (1... c5) *\n\n[White "Italian d6"]\n\n1. e4 d6 *';
    const items = selectedPgnImports(text, indexPgnGamesLight(text).entries, [0, 1], 'Italienne.pgn');
    assert.deepEqual(items.map(p => p.displayName), ['Italian h6', 'Italian d6']);
    assert.ok(items.every(p => p.filename === 'Italienne.pgn'));
    assert.equal(buildRepertoire(items[0]!.pgnText).trainingPaths!.length, 2);
    assert.equal(buildRepertoire(items[1]!.pgnText).trainingPaths!.length, 1);
  });
  it('hint does not move, undo, or trigger opponent play', () => {
    const src = readFileSync(new URL('../../../contexts/OpeningGameContext.tsx', import.meta.url), 'utf8');
    const action = src.split('const showExpectedMove =')[1]!.split('const changeColor =')[0]!;
    assert.doesNotMatch(action, /game\.move|undoPlayerTurn|opponentMoveRef|syncState|setPlayTurn/);
    assert.match(action, /expected\.map/);
    assert.match(action, /formatSanForDisplay/);
  });
});

