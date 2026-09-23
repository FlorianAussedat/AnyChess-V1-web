/**
 * AnyLyseur analysis profiles — web WASM vs Android native SF19.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYSIS_PROFILES,
  ANDROID_ANALYSIS_DEPTH_CAP,
  resolveAnalysisProfile,
} from '../profiles.ts';

describe('ANALYSIS_PROFILES (web)', () => {
  it('keeps the WASM Fast / Normal / Deep budgets', () => {
    assert.deepEqual(ANALYSIS_PROFILES.fast, {
      id: 'fast',
      depth: 12,
      movetimeMs: 250,
      multiPv: 3,
    });
    assert.deepEqual(ANALYSIS_PROFILES.normal, {
      id: 'normal',
      depth: 16,
      movetimeMs: 800,
      multiPv: 3,
    });
    assert.deepEqual(ANALYSIS_PROFILES.deep, {
      id: 'deep',
      depth: 20,
      movetimeMs: 2500,
      multiPv: 3,
    });
  });
});

describe('resolveAnalysisProfile', () => {
  it('leaves web / iOS on the WASM depth caps', () => {
    assert.equal(resolveAnalysisProfile('fast', 'web').depth, 12);
    assert.equal(resolveAnalysisProfile('normal', 'ios').depth, 16);
    assert.equal(resolveAnalysisProfile('deep', 'web').movetimeMs, 2500);
  });

  it('raises Android depth so movetime stays the limiter for SF19', () => {
    const fast = resolveAnalysisProfile('fast', 'android');
    const normal = resolveAnalysisProfile('normal', 'android');
    const deep = resolveAnalysisProfile('deep', 'android');
    assert.equal(fast.depth, ANDROID_ANALYSIS_DEPTH_CAP.fast);
    assert.equal(normal.depth, ANDROID_ANALYSIS_DEPTH_CAP.normal);
    assert.equal(deep.depth, ANDROID_ANALYSIS_DEPTH_CAP.deep);
    assert.equal(fast.movetimeMs, 250);
    assert.equal(normal.movetimeMs, 800);
    assert.equal(deep.movetimeMs, 2500);
    assert.equal(fast.multiPv, 3);
    assert.ok(fast.depth > ANALYSIS_PROFILES.fast.depth);
    assert.ok(normal.depth > ANALYSIS_PROFILES.normal.depth);
    assert.ok(deep.depth > ANALYSIS_PROFILES.deep.depth);
    assert.ok(fast.depth < normal.depth);
    assert.ok(normal.depth < deep.depth);
  });
});
