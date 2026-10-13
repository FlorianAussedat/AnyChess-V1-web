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

  it('opens the app instead of navigating to the Metro URL', () => {
    const url =
      'exp+mobile://expo-development-client/?url=' +
      encodeURIComponent('http://192.168.1.10:8081');
    assert.equal(rewriteDevSystemPath(url), '/');
    assert.equal(rewriteDevSystemPath('http://10.0.0.8:8081'), '/');
    assert.equal(rewriteDevSystemPath('http://10.0.0.8:8081/'), '/');
    assert.equal(rewriteDevSystemPath(url, false), '');
  });

  it('keeps an app path carried by the dev-client URL', () => {
    const url =
      'exp+mobile://expo-development-client/?url=' +
      encodeURIComponent('http://192.168.1.10:8081/classic?side=white');
    assert.equal(rewriteDevSystemPath(url), '/classic?side=white');
  });
});
