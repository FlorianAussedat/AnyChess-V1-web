/**
 * Write generated endgame-training pool + pipeline report.
 *
 * NOTE: The currently committed `pool.generated.ts` is the Syzygy quality seed.
 * Running the Lichess import will overwrite it — only do so intentionally after
 * reviewing the pipeline report. Do not empty the seed casually.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EndgameTrainingPosition } from '../domain/types.ts';
import type { PipelineReport } from './types.ts';

export type WriteGeneratedPoolOptions = {
  poolPath: string;
  reportPath: string;
  positions: readonly EndgameTrainingPosition[];
  report: PipelineReport;
};

function formatPoolModule(positions: readonly EndgameTrainingPosition[]): string {
  const body = positions.map((p) => `  ${JSON.stringify(p)},`).join('\n');
  return `/**
 * AUTO-GENERATED endgame training pool.
 *
 * The committed seed in this file is the Syzygy quality seed.
 * Re-running the Lichess offline import overwrites this module —
 * review pipeline-report.json before committing a full replace.
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
