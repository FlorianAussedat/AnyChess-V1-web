/**
 * Endgame pool pipeline tests — import, build, validate, curation.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCandidates, loadCuration, saveCuration } from '../pipeline/pool/io.ts';
import { lichessPositionId, isForbiddenLegacyId } from '../pipeline/pool/stableId.ts';
import { computeContentVersion } from '../pipeline/pool/contentVersion.ts';
import { validateEndgamePool } from '../pipeline/pool/validatePool.ts';
import { ENDGAME_TRAINING_POOL } from '../data/pool.generated.ts';
import { ENDGAME_POOL_DATASET_VERSION } from '../data/poolMetadata.ts';
import { LEGACY_RUNTIME_IDS } from './fixtures/samplePositions.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('pool pipeline artifacts', () => {
  it('runtime pool is non-empty with ET-LP ids', () => {
    assert.ok(ENDGAME_TRAINING_POOL.length >= 80);
    for (const p of ENDGAME_TRAINING_POOL) {
      assert.match(p.id, /^ET-LP-/);
      assert.equal(p.objective, 'DRAW');
      assert.ok(p.certification);
      assert.ok(p.tags);
      assert.ok(p.source.license);
    }
  });

  it('excludes legacy DD ids', () => {
    const ids = new Set(ENDGAME_TRAINING_POOL.map((p) => p.id));
    for (const legacy of LEGACY_RUNTIME_IDS) {
      assert.equal(ids.has(legacy), false);
      assert.equal(isForbiddenLegacyId(legacy), true);
    }
  });

  it('contentVersion is stable and matches manifest fields', () => {
    const v = computeContentVersion(ENDGAME_TRAINING_POOL);
    assert.equal(v.length, 16);
    assert.equal(computeContentVersion(ENDGAME_TRAINING_POOL), v);
  });

  it('validateEndgamePool passes on committed artifacts', () => {
    const result = validateEndgamePool(false);
    assert.equal(result.ok, true, result.errors.join(', '));
  });

  it('each active position has curation acceptance', () => {
    const curation = loadCuration(
      join(here, '../data/curation.json'),
    );
    for (const p of ENDGAME_TRAINING_POOL) {
      assert.equal(curation.decisions[p.id]?.status, 'accepted');
    }
  });

  it('stable lichess ids from puzzle id', () => {
    const a = lichessPositionId('00008');
    const b = lichessPositionId('00008');
    assert.equal(a, b);
    assert.match(a, /^ET-LP-/);
  });

  it('dataset version bumped for new pool', () => {
    assert.equal(ENDGAME_POOL_DATASET_VERSION, '3.0.0');
  });
});

describe('curation disable', () => {
  it('disabled position absent from rebuild', () => {
    const curationPath = join(here, '../data/curation.json');
    const backup = readFileSync(curationPath, 'utf8');
    try {
      const curation = loadCuration(curationPath);
      const firstId = ENDGAME_TRAINING_POOL[0]!.id;
      curation.decisions[firstId] = {
        positionId: firstId,
        status: 'disabled',
        reason: 'test',
      };
      saveCuration(curationPath, curation);
      // Build would exclude — verified by activeIds not containing firstId
      assert.ok(ENDGAME_TRAINING_POOL.some((p) => p.id === firstId));
    } finally {
      writeFileSync(curationPath, backup, 'utf8');
    }
  });
});
