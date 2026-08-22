/**
 * Write generated endgame-training pool + pipeline report.
 *
 * Replaces pool.generated.ts entirely — never merges with a previous pool.
 * Refuses to write when the pipeline produced zero positions.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EndgameTrainingPosition } from '../domain/types.ts';
import type { PipelineReport } from './types.ts';
import { ENDGAME_POOL_DATASET_VERSION } from '../data/poolMetadata.ts';

export type WriteGeneratedPoolOptions = {
  poolPath: string;
  reportPath: string;
  positions: readonly EndgameTrainingPosition[];
  report: PipelineReport;
};

function formatPoolModule(positions: readonly EndgameTrainingPosition[]): string {
  const body = positions.map((p) => `  ${JSON.stringify(p)},`).join('\n');
  return `/**
 * AUTO-GENERATED endgame training pool (product runtime).
 *
 * Replaced entirely by the offline Lichess import pipeline.
 * Dataset version: ${ENDGAME_POOL_DATASET_VERSION}
 * Runtime never loads Lichess CSV.
 */
import type { EndgameTrainingPosition } from '../domain/types.ts';

export const ENDGAME_TRAINING_POOL: readonly EndgameTrainingPosition[] = [
${body}
];
`;
}

export function writeGeneratedPool(
  options: WriteGeneratedPoolOptions,
): { poolPath: string; reportPath: string } {
  if (options.positions.length === 0) {
    throw new Error(
      'Refusing to write empty endgame training pool — fix the import pipeline or input CSV.',
    );
  }
  mkdirSync(dirname(options.poolPath), { recursive: true });
  mkdirSync(dirname(options.reportPath), { recursive: true });
  writeFileSync(options.poolPath, formatPoolModule(options.positions), 'utf8');
  writeFileSync(
    options.reportPath,
    `${JSON.stringify(options.report, null, 2)}\n`,
    'utf8',
  );
  return { poolPath: options.poolPath, reportPath: options.reportPath };
}
