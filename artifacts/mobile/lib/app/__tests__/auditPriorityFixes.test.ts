/**
 * Source / helper contracts for the high-priority audit fixes batch.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSanForDisplay } from '../../chess/notation.ts';
import {
  DEFAULT_VOICE_SPEED,
  voiceSpeedToRate,
} from '../../continueLine/voiceSpeed.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('Opening blur invalidates opponent generation', () => {
  it('OpeningGameContext focus cleanup bumps generation via cancelPendingOpponent', () => {
    const src = read('contexts/OpeningGameContext.tsx');
    assert.match(src, /cancelPendingOpponent\(\(\)\s*=>\s*opponent\.cancel\(\)\)/);
    assert.match(src, /cancelPendingOpponent/);
    // Must not leave a bare cancel/destroy without generation invalidation.
    assert.doesNotMatch(
      src,
      /return \(\) => \{\s*cancelled = true;\s*opponent\.cancel\(\);\s*opponent\.destroy\(\);/,
    );
  });
});

describe('Puzzle / Blind SAN display follow chessNotation', () => {
  it('PuzzleContext formats Coup suivant with formatSanForDisplay', () => {
    const src = read('contexts/PuzzleContext.tsx');
    assert.match(src, /formatSanForDisplay\(next\.san/);
    assert.match(src, /Coup suivant : \$\{displaySan\}/);
    assert.doesNotMatch(src, /Coup suivant : \$\{next\.san\}/);
  });

  it('BlindSequenceContext formats recognized move SANs', () => {
    const src = read('contexts/BlindSequenceContext.tsx');
    assert.match(src, /formatSanForDisplay\(parsed\.move\.san/);
    assert.match(src, /formatSanForDisplay\(parsed\.candidates\[0\]\.san/);
  });

  it('formatter examples used by puzzle/blind displays', () => {
    assert.equal(formatSanForDisplay('Nf3', 'fr'), 'Cf3');
    assert.equal(formatSanForDisplay('Bc4', 'fr'), 'Fc4');
    assert.equal(formatSanForDisplay('Qxd8+', 'fr'), 'Dxd8+');
    assert.equal(formatSanForDisplay('Nf3', 'en'), 'Nf3');
  });
});

describe('SpeechService uses global voiceSpeed by default', () => {
  it('resolves preference speed without sticky hardcoded rates in call sites', () => {
    const speech = read('services/SpeechService.ts');
    assert.match(speech, /voiceSpeedToRate/);
    assert.match(speech, /preferencesStore\.getPreferences\(\)\.voiceSpeed/);
    assert.match(speech, /resolveRate/);
    // Per-utterance rate on queue items (not sticky currentRate mutation).
    assert.match(speech, /rate:\s*this\.resolveRate/);
    assert.doesNotMatch(speech, /this\.currentRate\s*=/);

    for (const rel of [
      'app/visualisation/mental.tsx',
      'app/visualisation/jouer.tsx',
      'contexts/PuzzleContext.tsx',
      'hooks/useBlindDictation.ts',
      'lib/game/speakMoveHistory.ts',
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /rate:\s*0\.9/);
    }
  });

  it('voiceSpeedToRate is monotonic for 1–10', () => {
    assert.ok(voiceSpeedToRate(1) < voiceSpeedToRate(DEFAULT_VOICE_SPEED));
    assert.ok(voiceSpeedToRate(10) > voiceSpeedToRate(DEFAULT_VOICE_SPEED));
  });
});

describe('Classic keypad draft clears on notation change', () => {
  it('ClassicGameScreen clears draftMove when chessNotation changes', () => {
    const src = read('components/ClassicGameScreen.tsx');
    assert.match(src, /usePreferences\(\)/);
    assert.match(src, /setDraftMove\(''\)/);
    assert.match(src, /\[chessNotation\]/);
  });
});
