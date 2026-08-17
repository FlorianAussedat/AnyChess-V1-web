/**
 * Taxonomy, aliases, variety, and pool architecture for Défends la nulle.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  CERTIFIED_DEFEND_DRAW_POSITIONS,
} from '../positions.ts';
import {
  DEFEND_DRAW_DIFFICULTIES,
  ENDGAME_CONCEPTS,
  ENDGAME_FAMILIES,
  isEndgameConcept,
  isEndgameFamily,
  resolveDefendDrawDifficulty,
} from '../taxonomy.ts';
import { pickVariedCertifiedPosition } from '../variety.ts';
import { analyzeDrawingWalk } from '../analyzeDifficulty.ts';
import {
  DefendDrawPoolEmptyError,
  getDefendDrawPosition,
  listCertifiedEndgames,
} from '../EndgamePositionRepository.ts';
import type { CertifiedEndgamePosition } from '../EndgamePositionRepository.ts';
import { isAcceptableVerifiedDrawFlag } from '../certification.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

function stubPos(
  id: string,
  difficulty: CertifiedEndgamePosition['difficulty'],
  family: CertifiedEndgamePosition['family'],
): CertifiedEndgamePosition {
  return {
    id,
    fen: '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1',
    difficulty,
    family,
    concepts: ['opposition'],
    theme: 'test',
    label: 'test',
    defenderColor: 'b',
    playerColor: 'b',
    verifiedDraw: true,
    verified: true,
    initialOutcome: 'draw',
    verification: { method: 'syzygy', result: 'draw' },
    legalMoves: 3,
    drawingMoves: 2,
  };
}

describe('difficulty bands', () => {
  it('exposes exactly the four AnyChess levels (with English aliases)', () => {
    assert.deepEqual([...DEFEND_DRAW_DIFFICULTIES], [
      'debutant',
      'confirme',
      'expert',
      'grandMaitre',
    ]);
    assert.equal(resolveDefendDrawDifficulty('beginner'), 'debutant');
    assert.equal(resolveDefendDrawDifficulty('confirmed'), 'confirme');
    assert.equal(resolveDefendDrawDifficulty('expert'), 'expert');
    assert.equal(resolveDefendDrawDifficulty('grandmaster'), 'grandMaitre');
    assert.equal(resolveDefendDrawDifficulty('debutant'), 'debutant');
    assert.equal(resolveDefendDrawDifficulty('grandMaitre'), 'grandMaitre');
  });
});

describe('certified metadata', () => {
  it('every certified position has a family and at least one concept', () => {
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length >= 100);
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      assert.equal(isEndgameFamily(p.family), true, p.id);
      assert.ok(p.concepts.length >= 1, p.id);
      for (const c of p.concepts) {
        assert.equal(isEndgameConcept(c), true, `${p.id}:${c}`);
      }
      assert.ok(ENDGAME_FAMILIES.includes(p.family), p.id);
      assert.ok(p.concepts.every((c) => ENDGAME_CONCEPTS.includes(c)), p.id);
    }
  });

  it('no uncertified position can be returned', () => {
    for (const p of listCertifiedEndgames()) {
      assert.equal(p.verifiedDraw, true);
      assert.equal(p.verification.result, 'draw');
      assert.equal(
        isAcceptableVerifiedDrawFlag(p.verifiedDraw, p.verification),
        true,
        p.id,
      );
    }
    const src = read('lib/defendDraw/EndgamePositionRepository.ts');
    assert.match(src, /No random \/ procedural FEN fallback/);
    assert.doesNotMatch(src, /generateRandom|randomFen|procedural FEN generation/);
    assert.doesNotMatch(src, /new Chess\(\)/);
  });
});

describe('getDefendDrawPosition difficulty filter', () => {
  const aliasToId = {
    beginner: 'debutant',
    confirmed: 'confirme',
    expert: 'expert',
    grandmaster: 'grandMaitre',
  } as const;

  it('beginner/debutant never returns a Grandmaster position', () => {
    for (let i = 0; i < 16; i++) {
      const p = getDefendDrawPosition('beginner', [], () => i / 16);
      assert.equal(p.difficulty, 'debutant');
      assert.notEqual(p.difficulty, 'grandMaitre');
    }
    for (let i = 0; i < 16; i++) {
      const p = getDefendDrawPosition('debutant', [], () => i / 16);
      assert.equal(p.difficulty, 'debutant');
    }
  });

  it('each alias and native id stays inside its own band', () => {
    for (const [alias, id] of Object.entries(aliasToId)) {
      for (let i = 0; i < 12; i++) {
        const fromAlias = getDefendDrawPosition(
          alias as keyof typeof aliasToId,
          [],
          () => i / 12,
        );
        const fromId = getDefendDrawPosition(id, [], () => i / 12);
        assert.equal(fromAlias.difficulty, id);
        assert.equal(fromId.difficulty, id);
        assert.equal(fromAlias.verifiedDraw, true);
        assert.equal(fromId.verification.result, 'draw');
      }
    }
  });

  it('throws rather than inventing an uncertified FEN when the pool is empty', () => {
    assert.throws(
      () => pickVariedCertifiedPosition([], () => 0),
      /empty pool/,
    );
    assert.equal(typeof DefendDrawPoolEmptyError, 'function');
  });
});

describe('family variety', () => {
  it('avoids repeating the last family when alternatives exist', () => {
    const pool = [
      stubPos('R1', 'expert', 'rook'),
      stubPos('P1', 'expert', 'pawn'),
      stubPos('Q1', 'expert', 'queen'),
    ];
    for (let i = 0; i < 20; i++) {
      const picked = pickVariedCertifiedPosition(
        pool,
        () => i / 20,
        [],
        ['rook'],
      );
      assert.notEqual(picked.family, 'rook');
      assert.equal(picked.difficulty, 'expert');
      assert.equal(picked.verifiedDraw, true);
    }
  });

  it('does not break difficulty filters when avoiding a family', () => {
    for (let i = 0; i < 12; i++) {
      const p = getDefendDrawPosition('expert', [], () => i / 12, ['pawn']);
      assert.equal(p.difficulty, 'expert');
      assert.equal(p.verifiedDraw, true);
      assert.equal(p.verification.result, 'draw');
    }
  });

  it('still returns a certified row when the band is a single family', () => {
    const p = getDefendDrawPosition('debutant', [], () => 0.4, ['pawn']);
    assert.equal(p.difficulty, 'debutant');
    assert.equal(p.verifiedDraw, true);
    assert.ok(p.family);
  });
});

describe('pool architecture has no artificial size cap', () => {
  it('dataset is an unbounded array and selection does not slice to 5/10/20', () => {
    assert.equal(Array.isArray(CERTIFIED_DEFEND_DRAW_POSITIONS), true);
    const repo = read('lib/defendDraw/EndgamePositionRepository.ts');
    const positions = read('lib/defendDraw/positions.ts');
    assert.doesNotMatch(repo, /\.slice\(\s*0\s*,\s*(5|10|20)\s*\)/);
    assert.doesNotMatch(repo, /MAX_(POOL|POSITIONS|ENDGAMES)\s*=\s*(5|10|20)/);
    assert.doesNotMatch(positions, /MAX_(POOL|POSITIONS)\s*=/);
    assert.match(positions, /No artificial pool-size cap/);
  });

  it('variety pick works on a pool of hundreds of certified stubs', () => {
    const families = ['pawn', 'rook', 'queen', 'minor-piece', 'fortress', 'imbalanced'] as const;
    const pool = Array.from({ length: 240 }, (_, i) =>
      stubPos(`DD-X${i}`, 'expert', families[i % families.length]!),
    );
    const picked = pickVariedCertifiedPosition(pool, () => 0.33, [], ['rook', 'rook']);
    assert.ok(picked.id.startsWith('DD-X'));
    assert.equal(picked.difficulty, 'expert');
    assert.notEqual(picked.family, 'rook');
    assert.equal(listCertifiedEndgames().length, CERTIFIED_DEFEND_DRAW_POSITIONS.length);
  });
});

describe('analyzeDrawingWalk', () => {
  it('analyzeDrawingWalk counts unique move moments', async () => {
    const metrics = await analyzeDrawingWalk('8/8/8/8/8/8/8/8 w - - 0 1', {
      plyDepth: 1,
      fetchTb: async () => ({
        category: 'draw',
        moves: [
          { uci: 'e1e2', category: 'draw' },
          { uci: 'e1d1', category: 'loss' },
        ],
      }),
    });
    assert.ok(metrics);
    assert.equal(metrics!.uniqueMoveMoments, 1);
  });
});
