/**
 * Review → play against the repertoire draws one complete line with equal odds.
 * A later draw that repeats a line is allowed. That is not a folder bias.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRepertoire } from '../repertoireTree.ts';
import {
  eligibleReviewLines,
  listReviewPoolEntries,
  pickReviewLine,
  rememberReviewPick,
  resetReviewPickMemory,
  uniformLineIndex,
} from '../pickReviewLine.ts';
import { trainingPaths } from '../../continueLine/RepertoireBranchSelector.ts';
import type { RepertoireFolder, StoredPgnFile } from '../storage/types.ts';

const here = dirname(fileURLToPath(import.meta.url));

function folder(id: string, side: 'white' | 'black', enabled = true): RepertoireFolder {
  return { id, name: id, side, enabled, createdAt: '', updatedAt: '' };
}

function pgnFromLines(lines: string[]): string {
  return lines
    .map((moves, index) => `[Event "line-${index}"]\n\n${moves} *\n`)
    .join('\n');
}

function file(id: string, folderId: string, pgn: string, enabled = true): StoredPgnFile {
  const parsed = buildRepertoire(pgn);
  return {
    id,
    folderId,
    filename: `${id}.pgn`,
    importedAt: '',
    pgnText: pgn,
    enabled,
    summary: {
      gameCount: parsed.headers.length,
      positionCount: parsed.positionCount,
      branchCount: parsed.branchCount,
      parseSucceeded: parsed.positionCount > 0,
      errors: [],
      warnings: [],
    },
  };
}

const TWO = ['1. e4 e5', '1. d4 d5'];
const EIGHT = [
  '1. a3 a6',
  '1. a4 a5',
  '1. b3 b6',
  '1. b4 b5',
  '1. c3 c6',
  '1. c4 c5',
  '1. d3 d6',
  '1. g3 g6',
];

describe('uniform review line draw', () => {
  it('gives each complete line one slot across folders of different sizes', () => {
    resetReviewPickMemory();
    const folders = [folder('small', 'white'), folder('big', 'white')];
    const files = [
      file('two', 'small', pgnFromLines(TWO)),
      file('eight', 'big', pgnFromLines(EIGHT)),
      file('asleep', 'small', pgnFromLines(['1. f4 f5', '1. h3 h6', '1. h4 h5']), false),
    ];
    const entries = listReviewPoolEntries(folders, files);
    const lines = eligibleReviewLines(entries);
    assert.equal(lines.length, 10);
    assert.equal(lines.filter((line) => line.file.id === 'two').length, 2);
    assert.equal(lines.filter((line) => line.file.id === 'eight').length, 8);
    assert.equal(lines.filter((line) => line.file.id === 'asleep').length, 0);

    const hits = new Map<string, number>();
    for (let i = 0; i < lines.length; i += 1) {
      const pick = pickReviewLine(entries, { rng: () => i / lines.length });
      const key = `${pick?.file.id}:${pick?.path.sans.join(' ')}`;
      hits.set(key, (hits.get(key) ?? 0) + 1);
    }
    assert.equal(hits.size, 10);
    for (const count of hits.values()) assert.equal(count, 1);
    const smallHits = [...hits.keys()].filter((key) => key.startsWith('two:')).length;
    const bigHits = [...hits.keys()].filter((key) => key.startsWith('eight:')).length;
    assert.equal(smallHits, 2);
    assert.equal(bigHits, 8);
  });

  it('keeps the session color and ignores inactive folders', () => {
    const folders = [
      folder('white-small', 'white'),
      folder('white-big', 'white'),
      folder('black', 'black'),
      folder('off', 'white', false),
    ];
    const files = [
      file('two', 'white-small', pgnFromLines(TWO)),
      file('eight', 'white-big', pgnFromLines(EIGHT)),
      file('black-lines', 'black', pgnFromLines(['1. e4 c5', '1. e4 e6', '1. e4 c6', '1. e4 d6'])),
      file('hidden', 'off', pgnFromLines(['1. Nf3 Nf6'])),
    ];
    const entries = listReviewPoolEntries(folders, files);
    assert.equal(eligibleReviewLines(entries).length, 14);
    assert.equal(eligibleReviewLines(entries, { side: 'white' }).length, 10);
    assert.equal(eligibleReviewLines(entries, { side: 'black' }).length, 4);
    const next = pickReviewLine(entries, { side: 'black', rng: () => 0 });
    assert.equal(next?.side, 'black');
    assert.equal(next?.file.id, 'black-lines');
  });

  it('does not give a shared prefix or a duplicate game its own slot', () => {
    const branched = `[Event "tree"]\n\n1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 *`;
    const rep = buildRepertoire(branched);
    const sans = (rep.trainingPaths ?? []).map((path) => path.sans.join(' '));
    assert.equal(sans.length, 2);
    assert.ok(sans.includes('e4 c5 Nf3'));
    assert.ok(sans.includes('e4 e5 Nf3 Nc6'));
    assert.equal(sans.includes('e4'), false);

    const duplicated = buildRepertoire(`[Event "a"]\n\n1. e4 e5 *\n\n[Event "b"]\n\n1. e4 e5 *`);
    assert.equal(duplicated.trainingPaths?.length, 1);

    const folders = [folder('a', 'white'), folder('b', 'white')];
    const same = '1. e4 e5';
    const files = [
      file('left', 'a', pgnFromLines([same])),
      file('right', 'b', pgnFromLines([same])),
    ];
    const lines = eligibleReviewLines(listReviewPoolEntries(folders, files));
    assert.equal(lines.length, 2);
    assert.deepEqual(
      lines.map((line) => line.file.id),
      ['left', 'right'],
    );

    const short = buildRepertoire('1. e4 e5 *').trainingPaths ?? [];
    const long = buildRepertoire('1. d4 d5 2. c4 e6 3. Nc3 Nf6 *').trainingPaths ?? [];
    assert.equal(short.length, 1);
    assert.equal(long.length, 1);
    assert.notEqual(short[0]?.sans.length, long[0]?.sans.length);
  });

  it('treats two rng 0 draws as a legal repeat and ignores priority', () => {
    resetReviewPickMemory();
    const folders = [folder('a', 'white')];
    const plain = file('plain', 'a', pgnFromLines(['1. e4 e5']));
    const favorite = file('favorite', 'a', pgnFromLines(['1. d4 d5']));
    favorite.priority = true;
    const entries = listReviewPoolEntries(folders, [plain, favorite]);
    const first = pickReviewLine(entries, { rng: () => 0 });
    rememberReviewPick(first!.file.id, `${first!.file.id}:${first!.path.id}`);
    const second = pickReviewLine(entries, { rng: () => 0 });
    assert.equal(second?.file.id, first?.file.id);
    assert.equal(second?.path.id, first?.path.id);
    assert.equal(first?.file.id, 'plain');
    const last = pickReviewLine(entries, { rng: () => 0.999 });
    assert.equal(last?.file.id, 'favorite');
  });

  it('follows one complete book line instead of avoiding the previous draw', () => {
    const rep = buildRepertoire('1. e4 e5 (1... c5) *');
    const paths = trainingPaths(rep);
    assert.equal(paths.length, 2);
    const first = paths[uniformLineIndex(paths.length, () => 0)];
    const again = paths[uniformLineIndex(paths.length, () => 0)];
    assert.equal(again?.id, first?.id);
    assert.equal(first?.sans[0], 'e4');
    assert.ok((first?.sans.length ?? 0) > 1);
    const provider = readFileSync(join(here, '../../moves/MoveProviders.ts'), 'utf8');
    assert.match(provider, /uniformLineIndex\(candidates\.length/);
    assert.doesNotMatch(provider, /pickBalanced/);
    assert.doesNotMatch(provider, /this\.recent/);
  });
});
