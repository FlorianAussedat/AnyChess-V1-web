/**
 * Duplicate PGN filename policy for new imports.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normaliseFilename,
  uniquePgnFilename,
} from '../pgnFilename.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('uniquePgnFilename', () => {
  it('returns the normalized name when free', () => {
    assert.equal(uniquePgnFilename('Sicilian', []), 'Sicilian.pgn');
    assert.equal(uniquePgnFilename('Sicilian.pgn', []), 'Sicilian.pgn');
  });

  it('appends (2), (3), … when the name is taken (case-insensitive)', () => {
    const existing = ['Sicilian.pgn', 'Sicilian (2).pgn'];
    assert.equal(uniquePgnFilename('Sicilian.pgn', existing), 'Sicilian (3).pgn');
    assert.equal(uniquePgnFilename('sicilian.PGN', existing), 'sicilian (3).pgn');
  });

  it('normaliseFilename defaults empty to import.pgn', () => {
    assert.equal(normaliseFilename(''), 'import.pgn');
    assert.equal(normaliseFilename('  '), 'import.pgn');
  });

  it('RepertoireService.importPgn uses uniquePgnFilename', () => {
    const src = readFileSync(join(here, '../RepertoireService.ts'), 'utf8');
    assert.match(src, /uniquePgnFilename\(/);
    assert.match(src, /from '\.\/pgnFilename'/);
  });
});
