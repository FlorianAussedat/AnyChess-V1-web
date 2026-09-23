/**
 * DEV deep-link rewrite — Expo Router host/path mismatch.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rewriteDevSystemPath } from '../devDeepLink.ts';

describe('rewriteDevSystemPath', () => {
  it('maps mobile://dev/stockfish-uci to the file route', () => {
    assert.equal(
      rewriteDevSystemPath('mobile://dev/stockfish-uci'),
      '/dev/stockfish-uci',
    );
    assert.equal(
      rewriteDevSystemPath('mobile:///dev/stockfish-uci'),
      '/dev/stockfish-uci',
    );
    assert.equal(rewriteDevSystemPath('dev/stockfish-uci'), '/dev/stockfish-uci');
    assert.equal(rewriteDevSystemPath('/dev/stockfish-uci'), '/dev/stockfish-uci');
  });

  it('extracts the path from an Expo Dev Client URL', () => {
    const url =
      'exp+mobile://expo-development-client/?url=' +
      encodeURIComponent('https://example.exp.direct/dev/stockfish-uci');
    assert.equal(rewriteDevSystemPath(url), '/dev/stockfish-uci');
  });

  it('does not rewrite unrelated product paths', () => {
    assert.equal(rewriteDevSystemPath('/classic'), '/classic');
    assert.equal(rewriteDevSystemPath('/'), '/');
  });
});
