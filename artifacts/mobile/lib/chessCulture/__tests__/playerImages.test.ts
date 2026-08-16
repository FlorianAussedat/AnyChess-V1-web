/**
 * Player portrait registry + photo-question contracts (no Metro require() import).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHESS_CULTURE_QUESTIONS } from '../questions.ts';
import {
  createChessCultureQuizSession,
  emptyChessCultureFeedbackSnapshot,
  getEligibleChessCultureQuestions,
  hasResolvableChessCulturePresentation,
  validateChessCultureQuestion,
  validateChessCultureQuestionBank,
} from '../quizEngine.ts';
import {
  hasChessCultureImage,
  listChessCultureImageIds,
} from '../imageRegistryIds.ts';
import {
  PLAYER_IMAGE_FILENAMES,
  PLAYER_IMAGE_IDENTITIES,
  PLAYER_IMAGE_KEYS,
  isPlayerImageKey,
} from '../playerImageMeta.ts';
import { resolveChessCultureImageSource } from '../resolveImage.ts';
import type { ChessCultureQuestion } from '../types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const playersDir = path.join(root, 'assets', 'chess-culture', 'players');

describe('player image assets on disk', () => {
  it('registers exactly 11 stable player keys', () => {
    assert.equal(PLAYER_IMAGE_KEYS.length, 11);
    assert.equal(listChessCultureImageIds().length, 11);
    for (const key of PLAYER_IMAGE_KEYS) {
      assert.equal(hasChessCultureImage(key), true);
      assert.equal(isPlayerImageKey(key), true);
    }
  });

  it('ships every mapped local JPG (no remote URLs)', () => {
    for (const key of PLAYER_IMAGE_KEYS) {
      const filename = PLAYER_IMAGE_FILENAMES[key];
      const full = path.join(playersDir, filename);
      assert.ok(fs.existsSync(full), `missing ${filename}`);
      assert.ok(fs.statSync(full).size > 1000, `${filename} looks empty`);
    }
  });

  it('keeps static require() paths in playerImages.ts for Metro', () => {
    const src = fs.readFileSync(
      path.join(root, 'lib/chessCulture/playerImages.ts'),
      'utf8',
    );
    assert.doesNotMatch(src, /https?:\/\//);
    for (const key of PLAYER_IMAGE_KEYS) {
      const filename = PLAYER_IMAGE_FILENAMES[key];
      assert.match(
        src,
        new RegExp(
          `require\\('@/assets/chess-culture/players/${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)`,
        ),
        `missing require for ${key} → ${filename}`,
      );
    }
  });
});

describe('player photo quiz questions', () => {
  const photoQuestions = CHESS_CULTURE_QUESTIONS.filter((q) =>
    q.id.startsWith('player-photo-'),
  );

  it('includes at least one photo question per registered player', () => {
    assert.ok(photoQuestions.length >= 11);
    const covered = new Set(
      photoQuestions
        .map((q) => q.presentation?.imageId)
        .filter((id): id is string => typeof id === 'string'),
    );
    for (const key of PLAYER_IMAGE_KEYS) {
      assert.ok(covered.has(key), `missing photo question for ${key}`);
    }
  });

  it('maps each photo question to the correct player identity', () => {
    for (const q of photoQuestions) {
      const imageId = q.presentation?.imageId;
      assert.ok(imageId && isPlayerImageKey(imageId), `bad imageId on ${q.id}`);
      const expected = PLAYER_IMAGE_IDENTITIES[imageId];
      assert.equal(q.answers[q.correctAnswer], expected, q.id);
      assert.equal(q.presentation?.imageFit, 'cover');
      assert.equal(hasResolvableChessCulturePresentation(q), true);
      assert.deepEqual(validateChessCultureQuestion(q), []);
    }
  });

  it('passes bank validation for registered imageIds only', () => {
    const errors = validateChessCultureQuestionBank(CHESS_CULTURE_QUESTIONS, {
      knownImageIds: new Set(listChessCultureImageIds()),
    });
    assert.deepEqual(errors, []);
  });

  it('randomizes answers while preserving the correct identity', () => {
    const q = photoQuestions.find((item) => item.presentation?.imageId === 'gukesh');
    assert.ok(q);
    let n = 0;
    const random = () => {
      n += 1;
      return (n % 7) / 7;
    };
    const [sessionQ] = createChessCultureQuizSession([q!], 1, random);
    assert.ok(sessionQ);
    assert.equal(
      sessionQ.displayAnswers[sessionQ.correctDisplayIndex],
      PLAYER_IMAGE_IDENTITIES.gukesh,
    );
  });

  it('omits photo questions with unresolved image keys from the eligible pool', () => {
    const broken: ChessCultureQuestion = {
      ...photoQuestions[0]!,
      id: 'player-photo-broken',
      presentation: {
        imageId: 'notARealPlayer',
        imageFit: 'cover',
      },
    };
    assert.equal(hasResolvableChessCulturePresentation(broken), false);
    const eligible = getEligibleChessCultureQuestions(
      [broken, photoQuestions[0]!],
      emptyChessCultureFeedbackSnapshot(),
    );
    assert.deepEqual(
      eligible.map((q) => q.id),
      [photoQuestions[0]!.id],
    );
  });

  it('never uses remote image URLs in photo presentations', () => {
    for (const q of photoQuestions) {
      const blob = JSON.stringify(q.presentation);
      assert.doesNotMatch(blob, /https?:\/\//);
    }
  });

  it('fails closed when resolve lookup cannot find a key', () => {
    assert.equal(
      resolveChessCultureImageSource('magnusCarlsen', () => null),
      null,
    );
    assert.equal(hasChessCultureImage('missing-key'), false);
  });
});
