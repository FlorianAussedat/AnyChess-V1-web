/**
 * Source contracts for the theoretical play screen: no target, no duplicate
 * thinking line, reused board-hide and speech.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { movesToAnnounce } from '../voice/announceMoves.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('theoretical play UI contract', () => {
  const play = read('app/puzzles/finales-theoriques-play.tsx');

  it('shows the move count without a target', () => {
    assert.match(play, /theoreticalMovesPlayed/);
    assert.doesNotMatch(play, /targetUserMoves/);
    assert.doesNotMatch(play, /cible/);
  });

  it('keeps the upper status and drops the lower thinking row', () => {
    assert.match(play, /GameStatusCard/);
    assert.match(play, /isOpponentThinking/);
    const reflecting = play.match(/defendsNulleReflecting/g) ?? [];
    assert.equal(reflecting.length, 1);
    assert.doesNotMatch(play, /thinking && engineReady &&/);
  });

  it('reuses the existing board visibility components', () => {
    assert.match(play, /BoardVisibilityToggle/);
    assert.match(play, /HiddenBoardPlaceholder/);
    assert.match(play, /boardVisible/);
  });

  it('announces through the shared speech service and the mic pause', () => {
    assert.match(play, /speechService\.speak/);
    assert.match(play, /sanToVerbal/);
    assert.match(play, /voiceEnabled/);
    assert.match(play, /isSpeaking/);
    assert.match(play, /movesToAnnounce/);
  });

  it('renders the /5 headline', () => {
    assert.match(play, /headlineFor/);
    assert.match(play, /theoretical-quality-headline/);
    assert.match(play, /formatDuration/);
  });
});

describe('move announcements', () => {
  it('speaks only the new moves and stays silent when voice is off', () => {
    const on = movesToAnnounce(0, ['Ke2', 'Kd7'], true);
    assert.deepEqual(on.toSpeak, ['Ke2', 'Kd7']);
    const next = movesToAnnounce(on.nextCount, ['Ke2', 'Kd7', 'Ke3'], true);
    assert.deepEqual(next.toSpeak, ['Ke3']);
    const muted = movesToAnnounce(0, ['Ke2'], false);
    assert.deepEqual(muted.toSpeak, []);
    assert.equal(muted.nextCount, 1);
    const shrunk = movesToAnnounce(4, ['Ke2'], true);
    assert.deepEqual(shrunk.toSpeak, []);
  });
});
