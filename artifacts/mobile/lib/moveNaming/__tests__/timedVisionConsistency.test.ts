/**
 * Nommer le coup / Jouer le coup — Pass 3 family consistency checks.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardPerspectiveLabel } from '../boardPerspective.ts';
import { sideToMoveLabel } from '../../playMove/sideToMoveLabel.ts';

const here = dirname(fileURLToPath(import.meta.url));
const vizDir = join(here, '../../../app/visualisation');
const chromePath = join(
  here,
  '../../../components/visualisation/TimedVisionChrome.tsx',
);
const micPath = join(here, '../../../components/game/GameMicButton.tsx');

describe('timed vision start screens', () => {
  it('share start structure without pre-game voice config', () => {
    const chrome = readFileSync(chromePath, 'utf8');
    assert.match(chrome, /TimedVisionStart/);
    assert.match(chrome, /Record actuel/);
    assert.match(chrome, /Commencer/);
    assert.match(chrome, /Voir les records/);
    assert.match(chrome, /variant=\"secondary\"/);

    for (const file of ['nommer.tsx', 'jouer.tsx']) {
      const src = readFileSync(join(vizDir, file), 'utf8');
      assert.match(src, /TimedVisionStart/);
      assert.doesNotMatch(src, /BooleanSettingRow|Réponse vocale|nommer-voice-toggle/);
    }
  });
});

describe('timed vision session chrome', () => {
  it('forces coordinates off and removes board toolbar', () => {
    for (const file of ['nommer.tsx', 'jouer.tsx']) {
      const src = readFileSync(join(vizDir, file), 'utf8');
      assert.match(src, /showCoordinates=\{false\}/);
      assert.doesNotMatch(src, /BoardToolbar|useBoardCoordinates|toggleCoordinates/);
      assert.match(src, /useBoardSize\('wide'\)/);
      assert.match(src, /sizeMode=["']wide["']/);
    }
  });

  it('keeps perspective distinct from side to move on Nommer', () => {
    assert.equal(boardPerspectiveLabel('w'), 'Vision côté Blancs');
    assert.equal(boardPerspectiveLabel('b'), 'Vision côté Noirs');
    assert.equal(sideToMoveLabel('w'), 'Trait aux Blancs');
    assert.equal(sideToMoveLabel('b'), 'Trait aux Noirs');
    assert.notEqual(boardPerspectiveLabel('w'), sideToMoveLabel('w'));

    const nommer = readFileSync(join(vizDir, 'nommer.tsx'), 'utf8');
    assert.match(nommer, /nommer-perspective/);
    assert.match(nommer, /nommer-side-to-move/);
    assert.match(nommer, /boardPerspectiveLabel/);
    assert.match(nommer, /sideToMoveLabel/);
  });

  it('uses shared timer/score HUD and result chrome', () => {
    for (const file of ['nommer.tsx', 'jouer.tsx']) {
      const src = readFileSync(join(vizDir, file), 'utf8');
      assert.match(src, /TimedVisionHud/);
      assert.match(src, /TimedVisionResults/);
    }
    const chrome = readFileSync(chromePath, 'utf8');
    assert.match(chrome, /timed-vision-hud/);
    assert.match(chrome, /Score :/);
    assert.match(chrome, /Recommencer/);
    assert.match(chrome, /timed-vision-restart/);
  });

  it('keeps Nommer microphone during session with shared Parler / Écoute language', () => {
    const nommer = readFileSync(join(vizDir, 'nommer.tsx'), 'utf8');
    const mic = readFileSync(micPath, 'utf8');
    assert.match(nommer, /GameMicButton/);
    assert.match(nommer, /nommer-mic/);
    assert.match(nommer, /ChessAnswerInput/);
    assert.match(mic, /Parler/);
    assert.match(mic, /Écoute…/);
    assert.doesNotMatch(mic, /J'écoute|Activer le micro|Micro actif/);
  });

  it('does not add voice UI to Jouer board-only mechanic', () => {
    const jouer = readFileSync(join(vizDir, 'jouer.tsx'), 'utf8');
    assert.doesNotMatch(jouer, /GameMicButton|useSpeechInput/);
    assert.match(jouer, /jouer-prompt/);
  });
});
