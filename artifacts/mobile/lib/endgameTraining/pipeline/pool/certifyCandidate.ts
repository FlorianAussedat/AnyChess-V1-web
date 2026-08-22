/**
 * Move −1 certification via Lichess Syzygy tablebase.
 */
import { Chess } from 'chess.js';
import { probeWdlForPlayer, countDrawingMoves } from '../../../defendDraw/WdlProbe.ts';
import type { DefenderColor } from '../../domain/types.ts';
import type { CandidateCertification, OriginCriticalMove, PoolCandidate } from './types.ts';
import { pieceCountFromFen } from './family.ts';

const LICHESS_TB = 'https://tablebase.lichess.ovh/standard?fen=';

export type CertifyOptions = {
  fetchImpl?: typeof fetch;
  pauseMs?: number;
  minSafeMoves?: number;
  minPressureCp?: number;
  maxPressureCp?: number;
};

function mapVerdict(v: string): 'DRAW' | 'LOSS' | 'WIN' | null {
  if (v === 'draw') return 'DRAW';
  if (v === 'loss') return 'LOSS';
  if (v === 'win') return 'WIN';
  return null;
}

function uciToSan(fen: string, uci: string): string {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4]!.toLowerCase() : undefined;
  const game = new Chess(fen);
  const move = game.move({
    from,
    to,
    promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
  });
  return move?.san ?? uci;
}

function playerColorToWdl(c: DefenderColor): 'w' | 'b' {
  return c === 'white' ? 'w' : 'b';
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

export type CertifyCandidateResult =
  | { ok: true; candidate: PoolCandidate }
  | { ok: false; reason: string };

async function probeWithRetry(
  fen: string,
  player: 'w' | 'b',
  options: CertifyOptions,
  attempts = 3,
): Promise<{ verdict: string }> {
  let last = { verdict: 'unknown' };
  for (let i = 0; i < attempts; i++) {
    await sleep((options.pauseMs ?? 80) * (i + 1));
    last = await probeWdlForPlayer(fen, player, {
      fetchImpl: options.fetchImpl,
      tablebaseTimeoutMs: 12_000,
    });
    if (last.verdict !== 'unknown') return last;
  }
  return last;
}

export async function certifyMoveMinusOne(
  candidate: PoolCandidate,
  errorMoveUci: string,
  options: CertifyOptions = {},
): Promise<CertifyCandidateResult> {
  const fen = candidate.initialFen;
  const player = playerColorToWdl(candidate.playerColor);

  const before = await probeWithRetry(fen, player, options);
  const beforeVerdict = mapVerdict(before.verdict);
  if (beforeVerdict !== 'DRAW') {
    return { ok: false, reason: `before-not-draw:${before.verdict}` };
  }

  const afterFen = applyUciOrFail(fen, errorMoveUci);
  if (!afterFen) {
    return { ok: false, reason: 'illegal-error-move' };
  }

  const after = await probeWithRetry(afterFen, player, options);
  const afterVerdict = mapVerdict(after.verdict);
  if (afterVerdict !== 'LOSS') {
    return { ok: false, reason: `after-not-loss:${after.verdict}` };
  }

  const drawCounts = await countDrawingMoves(fen, {
    fetchImpl: options.fetchImpl,
    tablebaseTimeoutMs: 12_000,
  });
  const safeMoveCount = drawCounts.drawing >= 0 ? drawCounts.drawing : undefined;
  const minSafe = options.minSafeMoves ?? 2;
  if (safeMoveCount != null && safeMoveCount < minSafe) {
    return { ok: false, reason: `low-safe-moves:${safeMoveCount}` };
  }

  const pieces = pieceCountFromFen(fen);
  const certification: CandidateCertification = {
    type: pieces <= 7 ? 'syzygy' : 'stockfish-stable-draw',
    result: 'DRAW',
    details: {
      source: pieces <= 7 ? LICHESS_TB : 'lichess-tablebase-partial',
      pieceCount: pieces,
      beforeVerdict: before.verdict,
      afterVerdict: after.verdict,
      safeMoveCount,
      legalMoves: drawCounts.legal,
    },
  };

  const originCriticalMove: OriginCriticalMove = {
    uci: errorMoveUci,
    san: uciToSan(fen, errorMoveUci),
    verdictBefore: 'DRAW',
    verdictAfter: 'LOSS',
  };

  return {
    ok: true,
    candidate: {
      ...candidate,
      originCriticalMove,
      certification,
      pipelineStatus: 'certified',
      quality: {
        ...candidate.quality,
        safeMoveCount,
        pressureCp: estimatePressureCp(pieces),
      },
    },
  };
}

function applyUciOrFail(fen: string, uci: string): string | null {
  try {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4]!.toLowerCase() : undefined;
    const game = new Chess(fen);
    const move = game.move({
      from,
      to,
      promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    if (!move) return null;
    return game.fen();
  } catch {
    return null;
  }
}

function estimatePressureCp(pieceCount: number): number {
  // Syzygy draw with practical pressure — indicative only.
  if (pieceCount <= 5) return -60;
  if (pieceCount <= 7) return -90;
  return -120;
}
