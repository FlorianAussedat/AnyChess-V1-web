/**
 * End-of-line Review actions + hub / manage contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('openings hub', () => {
  it('offers Review, Learning and PGN management only', () => {
    const index = read('app/openings/index.tsx');
    assert.match(index, /openings-hub-review/);
    assert.match(index, /openings-hub-learn/);
    assert.match(index, /openings-manage-pgn-btn/);
    assert.doesNotMatch(index, /review-all-btn/);
    assert.doesNotMatch(index, /review-white-btn/);
    assert.doesNotMatch(index, /review-black-btn/);
    assert.doesNotMatch(index, /OpeningsReviewBlock/);
  });
});

describe('review screen', () => {
  it('shows the two exercises, pool summary, and no file CRUD', () => {
    const src = read('app/openings/review.tsx');
    assert.match(src, /review-play-btn/);
    assert.match(src, /review-continue-btn/);
    assert.match(src, /review-pool-summary/);
    assert.match(src, /pickReviewLineFromMemory/);
    assert.match(src, /review-manage-link/);
    assert.doesNotMatch(src, /importPgn/);
    assert.doesNotMatch(src, /deletePgn/);
    assert.doesNotMatch(src, /NameModal/);
  });
});

describe('line-complete actions', () => {
  it('offers Stockfish, analyse, study and next line at the last PGN move', () => {
    const panel = read('components/openings/TheoryDecisionPanel.tsx');
    assert.match(panel, /lineComplete/);
    assert.match(panel, /continueVsEngineShort/);
    assert.match(panel, /analyzeGame/);
    assert.match(panel, /studyThisOpening/);
    assert.match(panel, /nextLine/);
    assert.match(panel, /theory-next-line/);
  });

  it('play reloads a new pool line without returning to the menu', () => {
    const play = read('app/openings/play.tsx');
    assert.match(play, /onRequestNextLine/);
    assert.match(play, /pickReviewLineFromMemory/);
    assert.match(play, /repertoireFromSans/);
  });
});

describe('ephemeral study training', () => {
  it('study launches play/continue with an in-memory filter', () => {
    const study = read('app/openings/study.tsx');
    assert.match(study, /setEphemeralOpeningSession/);
    assert.match(study, /origin: 'study'/);
    assert.match(study, /opening-study-play-line/);
    assert.match(study, /opening-study-continue-line/);
    assert.doesNotMatch(study, /setFileEnabled/);
    assert.doesNotMatch(study, /setFolderEnabled/);
  });
});

describe('pedagogical reader is openings-specific', () => {
  it('study does not use the general parties analyzer as the opening reader', () => {
    const study = read('app/openings/study.tsx');
    assert.match(study, /createOpeningStudyState/);
    assert.match(study, /OpeningStudyCommentText/);
    assert.match(study, /OpeningStudyNotation/);
    assert.doesNotMatch(study, /SharedGameReaderView/);
    assert.doesNotMatch(study, /\/parties\/analyzer/);
  });

  it('manage view opens the pedagogical reader', () => {
    const manage = read('app/openings/manage.tsx');
    assert.match(manage, /\/openings\/study\?fileId=/);
    assert.match(manage, /needsOppositeSideMoveConfirm/);
  });
});
