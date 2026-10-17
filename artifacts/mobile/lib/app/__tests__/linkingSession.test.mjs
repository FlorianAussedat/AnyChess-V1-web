import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it, beforeEach } from 'node:test';

const require = createRequire(import.meta.url);
const session = require('../../../shims/anychess-linking-session/index.js');
const { patchExpoRouterLinkingSource } = require('../../../scripts/patchExpoRouterLinking.js');

const useLinkingPath = require.resolve('expo-router/build/fork/useLinking.native.js');
const linkingPath = require.resolve('expo-router/build/link/linking.js');

describe('linking session', () => {
  beforeEach(() => {
    session.resetLinkingSessionForTests();
  });

  it('cold start registers a single root and does not report a conflict', async () => {
    const root = session.claimLinkingRoot();
    const result = session.evaluateLinkingRoots();
    assert.equal(result.conflict, false);
    assert.equal(root.live, true);
    await new Promise((resolve) => queueMicrotask(resolve));
  });

  it('an already open app can take another link after the previous root releases', async () => {
    const first = session.claimLinkingRoot();
    session.evaluateLinkingRoots();
    session.releaseLinkingRoot(first);
    await new Promise((resolve) => queueMicrotask(resolve));
    const second = session.claimLinkingRoot();
    const result = session.evaluateLinkingRoots();
    assert.equal(result.conflict, false);
    assert.equal(first.live, false);
    assert.equal(second.live, true);
  });

  it('a Dev reload that abandoned the previous root keeps one owner and does not report', async () => {
    const abandoned = session.claimLinkingRoot();
    session.evaluateLinkingRoots();
    await new Promise((resolve) => queueMicrotask(resolve));
    const next = session.claimLinkingRoot();
    const result = session.evaluateLinkingRoots();
    assert.equal(result.conflict, false);
    assert.equal(result.released, 1);
    assert.equal(abandoned.live, false);
    assert.equal(next.live, true);
  });

  it('two roots claimed in the same turn stay reported', () => {
    session.claimLinkingRoot();
    session.claimLinkingRoot();
    const result = session.evaluateLinkingRoots();
    assert.equal(result.conflict, true);
    assert.equal(result.reported, true);
    const again = session.evaluateLinkingRoots();
    assert.equal(again.conflict, true);
    assert.equal(again.reported, false);
  });

  it('replaces a leaked url listener instead of stacking one', () => {
    const seen = [];
    const first = session.retainUrlSubscription(() => {
      const entry = { removed: false };
      seen.push(entry);
      return { remove() { entry.removed = true; } };
    });
    const second = session.retainUrlSubscription(() => {
      const entry = { removed: false };
      seen.push(entry);
      return { remove() { entry.removed = true; } };
    });
    assert.equal(seen.length, 2);
    assert.equal(seen[0].removed, true);
    assert.equal(seen[1].removed, false);
    first();
    assert.equal(seen[1].removed, false);
    second();
    assert.equal(seen[1].removed, true);
  });
});

describe('expo-router linking patch', () => {
  it('defers the duplicate-root error without removing it or the auth redirect', () => {
    const useLinking = patchExpoRouterLinkingSource(
      useLinkingPath,
      readFileSync(useLinkingPath, 'utf8'),
    );
    assert.match(useLinking, /claimLinkingRoot/);
    assert.match(useLinking, /Looks like you have configured linking in multiple places/);
    assert.match(useLinking, /android:launchMode=singleTask/);
    assert.doesNotMatch(useLinking, /LogBox\.ignoreLogs/);
    assert.doesNotMatch(useLinking, /linkingHandlers\.push/);

    const linking = patchExpoRouterLinkingSource(linkingPath, readFileSync(linkingPath, 'utf8'));
    assert.match(linking, /retainUrlSubscription/);
    assert.match(linking, /redirectSystemPath/);
    assert.match(linking, /if \(href\) \{\s*listener\(href\);/);
  });

  it('leaves unrelated files untouched', () => {
    assert.equal(patchExpoRouterLinkingSource('/app/_layout.tsx', 'export {}'), 'export {}');
  });
});
