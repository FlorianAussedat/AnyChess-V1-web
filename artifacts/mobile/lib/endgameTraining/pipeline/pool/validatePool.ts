/**
 * Validate endgame training pool artifacts.
 */
import { readFileSync, existsSync } from 'node:fs';
import { Chess } from 'chess.js';
import { ENDGAME_TRAINING_POOL } from '../../data/pool.generated.ts';
import { loadCandidates, loadCuration, loadManifest, loadPoolReport } from './io.ts';
import { isForbiddenLegacyId, FORBIDDEN_LEGACY_IDS } from './stableId.ts';
import { computeContentVersion } from './contentVersion.ts';
import { PATHS } from './paths.ts';

export type ValidateResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function validateEndgamePool(deep = false): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const manifest = loadManifest(PATHS.manifest);
  const report = loadPoolReport(PATHS.poolReport);
  const curation = loadCuration(PATHS.curation);
  const candidates = loadCandidates(PATHS.candidates);

  const ids = new Set<string>();
  for (const p of ENDGAME_TRAINING_POOL) {
    if (ids.has(p.id)) errors.push(`duplicate-id:${p.id}`);
    ids.add(p.id);

    if (isForbiddenLegacyId(p.id)) errors.push(`forbidden-legacy-id:${p.id}`);
    if (p.objective !== 'DRAW') errors.push(`wrong-objective:${p.id}`);
    if (!p.source?.license) errors.push(`missing-license:${p.id}`);
    if (!p.certification) errors.push(`missing-certification:${p.id}`);

    const decision = curation.decisions[p.id];
    if (!decision || decision.status !== 'accepted') {
      errors.push(`not-accepted-in-curation:${p.id}`);
    }

    try {
      const game = new Chess(p.fen);
      if (game.isGameOver()) errors.push(`terminal-position:${p.id}`);
      const stm = p.fen.split(' ')[1];
      const expected =
        p.defender === 'white' ? 'w' : p.defender === 'black' ? 'b' : null;
      if (expected && stm !== expected) {
        errors.push(`wrong-side-to-move:${p.id}`);
      }
    } catch {
      errors.push(`illegal-fen:${p.id}`);
    }

    if (p.id.startsWith('FIXTURE-')) errors.push(`fixture-in-runtime:${p.id}`);
  }

  for (const id of Object.keys(curation.decisions)) {
    if (curation.decisions[id]?.status === 'disabled') {
      if (ids.has(id)) errors.push(`disabled-in-runtime:${id}`);
    }
  }

  const computedVersion = computeContentVersion(ENDGAME_TRAINING_POOL);
  if (manifest && manifest.contentVersion !== computedVersion) {
    errors.push(
      `contentVersion-mismatch:manifest=${manifest.contentVersion} computed=${computedVersion}`,
    );
  }

  if (manifest && manifest.activeCount !== ENDGAME_TRAINING_POOL.length) {
    errors.push('manifest-active-count-mismatch');
  }

  if (report && report.active !== ENDGAME_TRAINING_POOL.length) {
    errors.push('report-active-count-mismatch');
  }

  if (deep && ENDGAME_TRAINING_POOL.length === 0) {
    warnings.push('empty-runtime-pool');
  }

  for (const legacy of FORBIDDEN_LEGACY_IDS) {
    if (typeof legacy === 'string' && legacy.startsWith('DD-') && ids.has(legacy)) {
      errors.push(`legacy-id-present:${legacy}`);
    }
  }

  // Verify pool.generated.ts on disk matches import
  if (existsSync(PATHS.poolGenerated)) {
    const src = readFileSync(PATHS.poolGenerated, 'utf8');
    for (const p of ENDGAME_TRAINING_POOL) {
      if (!src.includes(p.id)) errors.push(`missing-from-generated-file:${p.id}`);
    }
  }

  void candidates;

  return { ok: errors.length === 0, errors, warnings };
}
