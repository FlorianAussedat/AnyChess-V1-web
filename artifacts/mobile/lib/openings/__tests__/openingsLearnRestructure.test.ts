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

describe('opening PGN editor', () => {
  it('keeps both study tabs and auto-switches on node change', () => {
    const study = read('app/openings/study.tsx');
    assert.match(study, /opening-study-tab-comments/);
    assert.match(study, /opening-study-tab-notation/);
    assert.match(study, /preferredStudyTab/);
    assert.match(study, /lastAutoTabNodeId/);
    assert.match(study, /opening-study-annotate/);
    assert.match(study, /openings\.annotateThisPgn/);
  });

  it('manage offers create, annotate and export without hiding other actions', () => {
    const manage = read('app/openings/manage.tsx');
    assert.match(manage, /create-pgn-btn/);
    assert.match(manage, /annotate-pgn-/);
    assert.match(manage, /export-pgn-/);
    assert.match(manage, /view-pgn-/);
    assert.match(manage, /rename-pgn-/);
    assert.match(manage, /move-pgn-/);
    assert.match(manage, /toggle-pgn-/);
    assert.match(manage, /delete-pgn-/);
    assert.match(manage, /\/openings\/annotate\?fileId=/);
  });

  it('annotate screen saves to AnyChess, exports PGN and warns on unsaved leave', () => {
    const annotate = read('app/openings/annotate.tsx');
    assert.match(annotate, /createEmptyEditorSession/);
    assert.match(annotate, /loadEditorSessionFromPgn/);
    assert.match(annotate, /opening-annotate-save/);
    assert.match(annotate, /opening-annotate-export/);
    assert.match(annotate, /opening-unsaved-modal/);
    assert.match(annotate, /opening-confirm-variation/);
    assert.match(annotate, /opening-annotate-comment/);
    assert.match(annotate, /replacePgn/);
    assert.match(annotate, /importPgn/);
    assert.match(annotate, /editorAppendMove/);
    assert.match(annotate, /opening-annotate-analyze/);
    assert.match(annotate, /openEditorPositionInAnalyzer/);
    assert.match(annotate, /setParkedOpeningEditor/);
    assert.match(annotate, /takeParkedOpeningEditor/);
    assert.doesNotMatch(annotate, /textarea.*pgn/i);
  });

  it('analyzer offers return/add-line from the editor and create-study otherwise', () => {
    const analyzer = read('app/parties/analyzer.tsx');
    assert.match(analyzer, /OPENING_EDITOR_ANALYZER_SOURCE/);
    assert.match(analyzer, /anyliseur-return-editor/);
    assert.match(analyzer, /anyliseur-add-analyzed-line/);
    assert.match(analyzer, /graftAnalyzedLineOntoParkedEditor/);
    assert.match(analyzer, /anyliseur-create-opening-study/);
    assert.match(analyzer, /CreateOpeningStudyModal/);
    assert.match(analyzer, /createStudyFromHere/);
  });
});
