/**
 * Generate opening-like sequences without requiring Stockfish in tests.
 * Prefer Stockfish via ChessEngine when available.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../engine';
import { analyzeHistory } from './PositionHistoryAnalyzer.ts';
import { generateQuestions } from './PositionQuestionGenerator.ts';
import { MENTAL_MAX_QUESTIONS } from './MentalPositionSession.ts';

export async function generateMentalSequence(options: {
  fullMoves: number;
  engine?: ChessEngine | null;
  previousKey?: string | null;
  rng?: () => number;
}): Promise<{ sans: string[]; key: string }> {
  const half = Math.max(1, options.fullMoves) * 2;
  const rng = options.rng ?? Math.random;

  if (options.engine) {
    try {
      await options.engine.init?.();
      options.engine.newGame?.();
      const game = new Chess();
      const sans: string[] = [];
      for (let i = 0; i < half; i++) {
        if (game.isGameOver()) break;
        let selected: Move | null = null;
        try {
          selected = (await options.engine.pickMove(game)) ?? null;
        } catch {
          selected = null;
        }
        if (!selected) {
          const legal = game.moves({ verbose: true }) as Move[];
          if (!legal.length) break;
          selected = legal[Math.floor(rng() * Math.min(legal.length, 5))];
        }
        const played = game.move({
          from: selected.from,
          to: selected.to,
          promotion: selected.promotion || 'q',
        }) as Move;
        sans.push(played.san);
      }
      const key = sans.join(' ');
      if (!options.previousKey || key !== options.previousKey) {
        return { sans, key };
      }
    } catch {
      // fall through to random
    }
  }

  const game = new Chess();
  const sans: string[] = [];
  for (let i = 0; i < half; i++) {
    const legal = game.moves({ verbose: true }) as Move[];
    if (!legal.length) break;
    const pick = legal[Math.floor(rng() * Math.min(legal.length, 6))];
    const played = game.move({ from: pick.from, to: pick.to, promotion: pick.promotion || 'q' }) as Move;
    sans.push(played.san);
  }
  return { sans, key: sans.join(' ') };
}

const MAX_SEQUENCE_RETRIES = 4;

/**
 * Generate a sequence long enough to produce the requested question count.
 */
export async function generateMentalSequenceWithQuestions(options: {
  fullMoves: number;
  engine?: ChessEngine | null;
  previousKey?: string | null;
  rng?: () => number;
  maxQuestions?: number;
}): Promise<{ sans: string[]; key: string; fullMovesUsed: number }> {
  const maxQuestions = options.maxQuestions ?? MENTAL_MAX_QUESTIONS;
  const rng = options.rng ?? Math.random;

  for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt++) {
    const fullMovesUsed = options.fullMoves + attempt;
    const { sans, key } = await generateMentalSequence({
      fullMoves: fullMovesUsed,
      engine: options.engine,
      previousKey: attempt === 0 ? options.previousKey : null,
      rng,
    });
    const analysis = analyzeHistory(sans);
    const questions = generateQuestions(analysis, { maxQuestions, rng });
    if (questions.length >= maxQuestions) {
      return { sans, key, fullMovesUsed };
    }
  }

  throw new Error('Pas assez de questions fiables');
}
