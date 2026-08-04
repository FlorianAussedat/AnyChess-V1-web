import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANYCHESS_NAVY,
  ANYCHESS_TAGLINE,
  EXIT_FADE_DURATION_MS,
  LATE_READY_HOLD_MS,
  LOGO_FADE_DELAY_MS,
  MIN_INTRO_MS,
  TAGLINE_FADE_DELAY_MS,
  WORDMARK_FADE_DELAY_MS,
  msUntilExitFadeStart,
  totalIntroBudgetMs,
} from '../splashTiming.ts';

describe('AnyChess splash timing', () => {
  it('keeps the brand navy aligned with the app background', () => {
    assert.equal(ANYCHESS_NAVY, '#0B1728');
  });

  it('uses the official French tagline', () => {
    assert.equal(ANYCHESS_TAGLINE, 'JOUER. APPRENDRE. VISUALISER.');
  });

  it('staggers logo → wordmark → tagline before the exit window', () => {
    assert.ok(LOGO_FADE_DELAY_MS < WORDMARK_FADE_DELAY_MS);
    assert.ok(WORDMARK_FADE_DELAY_MS < TAGLINE_FADE_DELAY_MS);
    assert.ok(TAGLINE_FADE_DELAY_MS < MIN_INTRO_MS);
    assert.ok(MIN_INTRO_MS >= 2000);
    assert.ok(MIN_INTRO_MS + EXIT_FADE_DURATION_MS <= 2600);
  });

  it('does not schedule an exit fade until the app is ready', () => {
    assert.equal(
      msUntilExitFadeStart({
        introStartedAtMs: 0,
        appReadyAtMs: null,
        nowMs: 5000,
      }),
      null,
    );
  });

  it('waits out the minimum intro when ready early', () => {
    assert.equal(
      msUntilExitFadeStart({
        introStartedAtMs: 1000,
        appReadyAtMs: 1100,
        nowMs: 1500,
      }),
      MIN_INTRO_MS - 500,
    );
  });

  it('starts the exit fade immediately once the minimum intro has elapsed and ready is settled', () => {
    assert.equal(
      msUntilExitFadeStart({
        introStartedAtMs: 0,
        appReadyAtMs: 0,
        nowMs: MIN_INTRO_MS + LATE_READY_HOLD_MS,
      }),
      0,
    );
  });

  it('holds briefly when ready arrives after the minimum intro', () => {
    const readyAt = MIN_INTRO_MS + 50;
    assert.equal(
      msUntilExitFadeStart({
        introStartedAtMs: 0,
        appReadyAtMs: readyAt,
        nowMs: readyAt,
      }),
      LATE_READY_HOLD_MS,
    );
  });

  it('keeps the total budget near 2.0–2.5s when init is fast', () => {
    const budget = totalIntroBudgetMs();
    assert.ok(budget >= 2000);
    assert.ok(budget <= 2600);
  });
});
