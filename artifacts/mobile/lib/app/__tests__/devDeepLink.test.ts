/**
 * DEV deep-link rewrite — one decision per incoming URL.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  lastLinkingDecision,
  rewriteDevSystemPath,
} from '../devDeepLink.ts';

const SIGNUP =
  'https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm#access_token=abc&refresh_token=def&type=signup';
const RECOVERY =
  'https://zqfxnzwtptepulmgpxhb.supabase.co/auth/v1/verify?token=otp&type=recovery&redirect_to=' +
  encodeURIComponent('https://anychess.example/auth/confirm');
const RECOVERY_PAGE =
  'https://anychess.example/auth/confirm#access_token=abc&type=recovery';

function connectionUrl(inner: string): string {
  return (
    'exp+mobile://expo-development-client/?url=' + encodeURIComponent(inner)
  );
}

describe('rewriteDevSystemPath', () => {
  it('maps mobile://dev/stockfish-uci to the file route once', () => {
    const once = rewriteDevSystemPath('mobile://dev/stockfish-uci');
    assert.equal(once, '/dev/stockfish-uci');
    assert.equal(rewriteDevSystemPath('mobile:///dev/stockfish-uci'), '/dev/stockfish-uci');
    assert.equal(rewriteDevSystemPath('dev/stockfish-uci'), '/dev/stockfish-uci');
    assert.equal(rewriteDevSystemPath('/dev/stockfish-uci'), '/dev/stockfish-uci');
    assert.equal(rewriteDevSystemPath(once), once);
    assert.deepEqual(lastLinkingDecision(), {
      action: 'rewrite-dev-route',
      to: '/dev/stockfish-uci',
    });
  });

  it('extracts a dev route nested in an Expo Dev Client URL once', () => {
    const url = connectionUrl('https://example.exp.direct/dev/stockfish-uci');
    assert.equal(rewriteDevSystemPath(url), '/dev/stockfish-uci');
    assert.equal(rewriteDevSystemPath(rewriteDevSystemPath(url)), '/dev/stockfish-uci');
  });

  it('filters a Metro connection without opening home or reloading the bundler', () => {
    const cases = [
      connectionUrl('http://192.168.1.10:8081'),
      connectionUrl('https://abcd.exp.direct'),
      connectionUrl('https://abcd.exp.direct/'),
      connectionUrl('https://name.trycloudflare.com/index.bundle?platform=android'),
      'http://10.0.0.8:8081',
      'http://10.0.0.8:8081/',
      'https://abcd.exp.direct',
    ];
    for (const url of cases) {
      for (const initial of [true, false]) {
        const result = rewriteDevSystemPath(url, initial);
        assert.equal(result, '', url);
        assert.notEqual(result, '/');
        assert.equal(result.startsWith('http'), false);
        assert.deepEqual(lastLinkingDecision(), {
          action: 'filter-dev-client-connection',
        });
        assert.equal(rewriteDevSystemPath(result, initial), '');
      }
    }
  });

  it('keeps an app path carried by the dev client, including an open session', () => {
    const url = connectionUrl('https://abcd.exp.direct/classic?side=white');
    assert.equal(rewriteDevSystemPath(url, true), '/classic?side=white');
    assert.equal(rewriteDevSystemPath(url, false), '/classic?side=white');
    assert.deepEqual(lastLinkingDecision(), {
      action: 'preserve-app-path',
      to: '/classic?side=white',
    });
    assert.equal(rewriteDevSystemPath('/parties/import'), '/parties/import');
    assert.deepEqual(lastLinkingDecision(), { action: 'pass-through' });
  });

  it('does not rewrite unrelated product paths to home', () => {
    assert.equal(rewriteDevSystemPath('/classic'), '/classic');
    assert.equal(rewriteDevSystemPath('/'), '/');
    assert.equal(rewriteDevSystemPath('https://example.com/classic'), 'https://example.com/classic');
  });

  it('preserves account confirmation and password recovery links', () => {
    for (const url of [SIGNUP, RECOVERY, RECOVERY_PAGE]) {
      assert.equal(rewriteDevSystemPath(url, true), url);
      assert.equal(rewriteDevSystemPath(url, false), url);
      assert.equal(rewriteDevSystemPath(rewriteDevSystemPath(url)), url);
      assert.deepEqual(lastLinkingDecision(), { action: 'preserve-auth-link' });
    }
    const wrapped = connectionUrl(SIGNUP);
    assert.equal(rewriteDevSystemPath(wrapped), SIGNUP);
    assert.match(rewriteDevSystemPath(wrapped), /type=signup/);
    assert.match(rewriteDevSystemPath(connectionUrl(RECOVERY_PAGE)), /type=recovery/);
    assert.doesNotMatch(rewriteDevSystemPath(wrapped), /^\/$/);
  });

  it('opens Utilisateur from the confirmation button, cold and already running', () => {
    const links = [
      'exp+anychessdev://open',
      'exp+anychessdev://utilisateur',
      'exp+mobile://open',
      'exp+mobile://utilisateur',
      'anychess://open',
      'anychess://utilisateur',
      'mobile://open',
      'intent://open#Intent;scheme=exp+mobile;package=com.anychess.app;end',
      'intent://utilisateur#Intent;scheme=anychess;package=com.anychess.standalone;end',
      'exp+mobile://',
      'anychess://',
      '/open',
      'open',
      '/utilisateur',
    ];
    for (const link of links) {
      for (const initial of [true, false]) {
        assert.equal(rewriteDevSystemPath(link, initial), '/utilisateur', link);
        assert.deepEqual(lastLinkingDecision(), {
          action: 'rewrite-account-return',
          to: '/utilisateur',
        });
      }
    }
    assert.equal(rewriteDevSystemPath('/openings'), '/openings');
    assert.equal(rewriteDevSystemPath('/openings/learn', false), '/openings/learn');
    assert.equal(
      rewriteDevSystemPath(connectionUrl('https://abcd.exp.direct'), false),
      '',
    );
  });
});
