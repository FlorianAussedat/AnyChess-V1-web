import type { RawCandidate } from './candidateTypes.ts';
import { THEORETICAL_DRAW_SEEDS } from './theoreticalSeeds.ts';
import { createSeededRng } from './seededRng.ts';
import {
  kingsTooClose,
  normalizeFenKey,
  tryBuildFen,
} from './fenUtils.ts';

const FILES = [0, 1, 2, 3, 4, 5, 6, 7];

/** Systematic K+P vs K with defender to move. */
function generateKPvK(limit: number): RawCandidate[] {
  const out: RawCandidate[] = [];
  outer: for (const pFile of FILES) {
    for (let pRank = 1; pRank <= 5; pRank++) {
      for (const wkFile of FILES) {
        for (let wkRank = 0; wkRank <= 6; wkRank++) {
          for (const bkFile of FILES) {
            for (let bkRank = 0; bkRank <= 7; bkRank++) {
              if (out.length >= limit) break outer;
              const wk = { file: wkFile, rank: wkRank };
              const bk = { file: bkFile, rank: bkRank };
              const pp = { file: pFile, rank: pRank };
              if (
                (wk.file === pp.file && wk.rank === pp.rank) ||
                (bk.file === pp.file && bk.rank === pp.rank) ||
                (wk.file === bk.file && wk.rank === bk.rank) ||
                kingsTooClose(wk, bk)
              ) {
                continue;
              }
              const fen = tryBuildFen(
                [
                  { type: 'k', color: 'w', ...wk },
                  { type: 'k', color: 'b', ...bk },
                  { type: 'p', color: 'w', ...pp },
                ],
                'b',
              );
              if (!fen) continue;
              out.push({
                fen,
                defenderColor: 'b',
                theme: 'kpvk',
                label: 'Roi contre pion',
                source: { type: 'theoretical' },
                generatorTag: 'kpvk',
              });
            }
          }
        }
      }
    }
  }
  return out;
}

/** K+P vs K with white defending (black pawn). */
function generateKvsKP(limit: number): RawCandidate[] {
  const out: RawCandidate[] = [];
  outer: for (const pFile of FILES) {
    for (let pRank = 2; pRank <= 6; pRank++) {
      for (const wkFile of FILES) {
        for (let wkRank = 0; wkRank <= 7; wkRank++) {
          for (const bkFile of FILES) {
            for (let bkRank = 0; bkRank <= 6; bkRank++) {
              if (out.length >= limit) break outer;
              const wk = { file: wkFile, rank: wkRank };
              const bk = { file: bkFile, rank: bkRank };
              const pp = { file: pFile, rank: pRank };
              if (
                (wk.file === pp.file && wk.rank === pp.rank) ||
                (bk.file === pp.file && bk.rank === pp.rank) ||
                (wk.file === bk.file && wk.rank === bk.rank) ||
                kingsTooClose(wk, bk)
              ) {
                continue;
              }
              const fen = tryBuildFen(
                [
                  { type: 'k', color: 'w', ...wk },
                  { type: 'k', color: 'b', ...bk },
                  { type: 'p', color: 'b', ...pp },
                ],
                'w',
              );
              if (!fen) continue;
              out.push({
                fen,
                defenderColor: 'w',
                theme: 'kpvk',
                label: 'Roi contre pion (blancs)',
                source: { type: 'theoretical' },
                generatorTag: 'kvkp',
              });
            }
          }
        }
      }
    }
  }
  return out;
}

/** Rook vs rook + optional pawns — sampled. */
function generateRookEndings(
  rng: ReturnType<typeof createSeededRng>,
  limit: number,
): RawCandidate[] {
  const out: RawCandidate[] = [];
  let attempts = 0;
  while (out.length < limit && attempts < limit * 40) {
    attempts += 1;
    const wk = { file: rng.int(0, 7), rank: rng.int(0, 7) };
    const bk = { file: rng.int(0, 7), rank: rng.int(0, 7) };
    if (kingsTooClose(wk, bk)) continue;
    const wr = { file: rng.int(0, 7), rank: rng.int(1, 6) };
    const br = { file: rng.int(0, 7), rank: rng.int(1, 6) };
    const pieces: Array<{
      type: string;
      color: 'w' | 'b';
      file: number;
      rank: number;
    }> = [
      { type: 'k', color: 'w', ...wk },
      { type: 'k', color: 'b', ...bk },
      { type: 'r', color: 'w', ...wr },
      { type: 'r', color: 'b', ...br },
    ];
    if (rng.next() < 0.6) {
      pieces.push({
        type: 'p',
        color: rng.next() < 0.5 ? 'w' : 'b',
        file: rng.int(0, 7),
        rank: rng.int(1, 5),
      });
    }
    const stm: 'w' | 'b' = rng.next() < 0.5 ? 'w' : 'b';
    const fen = tryBuildFen(pieces, stm);
    if (!fen) continue;
    out.push({
      fen,
      defenderColor: stm,
      theme: 'rook-ending',
      label: 'Finale de tours',
      source: { type: 'theoretical' },
      generatorTag: 'rook',
    });
  }
  return out;
}

/** Queen / minor / imbalanced — sampled ≤7 pieces. */
function generateMixedEndings(
  rng: ReturnType<typeof createSeededRng>,
  limit: number,
): RawCandidate[] {
  const templates: Array<{
    pieces: Array<{ type: string; color: 'w' | 'b' }>;
    stm: 'w' | 'b';
    theme: string;
    label: string;
    tag: string;
  }> = [
    {
      pieces: [
        { type: 'k', color: 'w' },
        { type: 'k', color: 'b' },
        { type: 'q', color: 'w' },
        { type: 'q', color: 'b' },
      ],
      stm: 'b',
      theme: 'queen-ending',
      label: 'Dames',
      tag: 'qq',
    },
    {
      pieces: [
        { type: 'k', color: 'w' },
        { type: 'k', color: 'b' },
        { type: 'q', color: 'w' },
        { type: 'r', color: 'b' },
      ],
      stm: 'w',
      theme: 'queen-vs-rook',
      label: 'Dame vs tour',
      tag: 'qr',
    },
    {
      pieces: [
        { type: 'k', color: 'w' },
        { type: 'k', color: 'b' },
        { type: 'n', color: 'w' },
        { type: 'n', color: 'b' },
        { type: 'p', color: 'w' },
        { type: 'p', color: 'b' },
      ],
      stm: 'b',
      theme: 'minor-pawns',
      label: 'Cavaliers',
      tag: 'nn',
    },
    {
      pieces: [
        { type: 'k', color: 'w' },
        { type: 'k', color: 'b' },
        { type: 'b', color: 'w' },
        { type: 'b', color: 'b' },
        { type: 'p', color: 'w' },
      ],
      stm: 'w',
      theme: 'opposite-bishops',
      label: 'Fous opposés',
      tag: 'bb',
    },
    {
      pieces: [
        { type: 'k', color: 'w' },
        { type: 'k', color: 'b' },
        { type: 'r', color: 'w' },
        { type: 'b', color: 'b' },
      ],
      stm: 'b',
      theme: 'imbalanced',
      label: 'Tour vs fou',
      tag: 'rb',
    },
    {
      pieces: [
        { type: 'k', color: 'w' },
        { type: 'k', color: 'b' },
        { type: 'r', color: 'w' },
        { type: 'n', color: 'b' },
        { type: 'p', color: 'b' },
      ],
      stm: 'w',
      theme: 'imbalanced',
      label: 'Tour vs cavalier',
      tag: 'rn',
    },
  ];

  const out: RawCandidate[] = [];
  let attempts = 0;
  while (out.length < limit && attempts < limit * 50) {
    attempts += 1;
    const tpl = rng.pick(templates);
    const coords: Array<{ type: string; color: 'w' | 'b'; file: number; rank: number }> = [];
    const used = new Set<string>();
    let ok = true;
    for (const p of tpl.pieces) {
      let placed = false;
      for (let t = 0; t < 30; t++) {
        const file = rng.int(0, 7);
        const rank = rng.int(0, 7);
        const key = `${file},${rank}`;
        if (used.has(key)) continue;
        used.add(key);
        coords.push({ ...p, file, rank });
        placed = true;
        break;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const wk = coords.find((c) => c.type === 'k' && c.color === 'w')!;
    const bk = coords.find((c) => c.type === 'k' && c.color === 'b')!;
    if (kingsTooClose(wk, bk)) continue;
    const fen = tryBuildFen(coords, tpl.stm);
    if (!fen) continue;
    out.push({
      fen,
      defenderColor: tpl.stm,
      theme: tpl.theme,
      label: tpl.label,
      source: { type: 'theoretical' },
      generatorTag: tpl.tag,
    });
  }
  return out;
}

function dedupePush(
  out: RawCandidate[],
  seen: Set<string>,
  candidate: RawCandidate,
): void {
  const key = normalizeFenKey(candidate.fen);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(candidate);
}

export type GenerateOptions = {
  seed: number;
  kpvkLimit?: number;
  kvkpLimit?: number;
  rookLimit?: number;
  mixedLimit?: number;
};

/** Build the full candidate list (deterministic with seed). */
export function generateAllCandidates(
  options: GenerateOptions,
  pgnCandidates: RawCandidate[] = [],
): RawCandidate[] {
  const seen = new Set<string>();
  const rng = createSeededRng(options.seed);
  const kpvkLimit = options.kpvkLimit ?? 80;
  const kvkpLimit = options.kvkpLimit ?? 50;
  const rookLimit = options.rookLimit ?? 350;
  const mixedLimit = options.mixedLimit ?? 250;

  const out: RawCandidate[] = [];

  for (const c of pgnCandidates) dedupePush(out, seen, c);
  for (const c of THEORETICAL_DRAW_SEEDS) dedupePush(out, seen, c);
  for (const c of generateKPvK(kpvkLimit)) dedupePush(out, seen, c);
  for (const c of generateKvsKP(kvkpLimit)) dedupePush(out, seen, c);
  for (const c of generateRookEndings(rng, rookLimit)) dedupePush(out, seen, c);
  for (const c of generateMixedEndings(rng, mixedLimit)) dedupePush(out, seen, c);

  return rng.shuffle(out);
}
