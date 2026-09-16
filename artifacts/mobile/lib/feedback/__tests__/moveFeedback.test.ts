import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORRECT_FEEDBACK_MS,
  initialMoveFeedbackState,
  reduceMoveFeedback,
} from '../moveFeedback.ts';
import {
  ANYCHESS_DIFFICULTIES,
  DIFFICULTY_ASSET_FILES,
  isAnyChessDifficultyId,
} from '../../difficulty/anyChessDifficulty.ts';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const difficultyDir = join(here, '../../../assets/brand/mascots/difficulty');

describe('moveFeedback reducer', () => {
  it('starts idle and signals correct / incorrect / invalid', () => {
    let s = initialMoveFeedbackState();
    assert.equal(s.kind, 'idle');
    s = reduceMoveFeedback(s, { type: 'correct' });
    assert.equal(s.kind, 'correct');
    assert.equal(s.eventId, 1);
    s = reduceMoveFeedback(s, { type: 'incorrect', message: 'retry' });
    assert.equal(s.kind, 'incorrect');
    assert.equal(s.message, 'retry');
    s = reduceMoveFeedback(s, { type: 'invalid' });
    assert.equal(s.kind, 'invalid');
    s = reduceMoveFeedback(s, { type: 'nextAttempt' });
    assert.equal(s.kind, 'idle');
  });

  it('exposes a 3s correct window constant', () => {
    assert.equal(CORRECT_FEEDBACK_MS, 3000);
  });
});

describe('AnyChess difficulty assets', () => {
  it('maps four levels to the exact provided filenames', () => {
    assert.deepEqual([...ANYCHESS_DIFFICULTIES], [
      'debutant',
      'confirme',
      'expert',
      'grandMaitre',
    ]);
    assert.equal(DIFFICULTY_ASSET_FILES.debutant, 'debutant.png');
    assert.equal(DIFFICULTY_ASSET_FILES.confirme, 'confirme.png');
    assert.equal(DIFFICULTY_ASSET_FILES.expert, 'expert.png');
    assert.equal(DIFFICULTY_ASSET_FILES.grandMaitre, 'GM.png');
    for (const id of ANYCHESS_DIFFICULTIES) {
      assert.ok(isAnyChessDifficultyId(id));
      const full = join(difficultyDir, DIFFICULTY_ASSET_FILES[id]);
      assert.ok(existsSync(full), `missing ${DIFFICULTY_ASSET_FILES[id]}`);
    }
  });
});
