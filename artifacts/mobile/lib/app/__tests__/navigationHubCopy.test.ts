/**
 * Home + hub navigation copy and shared submenu structure.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '../../i18n/messages.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('navigation hub copy', () => {
  it('uses the specified French home descriptions', () => {
    assert.equal(
      translate('fr', 'modes.classic.description'),
      'Joue aux échecs sur l’échiquier ou à la voix.',
    );
    assert.equal(
      translate('fr', 'modes.openings.description'),
      'Apprends tes ouvertures et entraîne-toi à les rejouer.',
    );
    assert.equal(
      translate('fr', 'modes.blind.description'),
      'Retiens des suites de coups en les écoutant ou en les regardant.',
    );
    assert.equal(
      translate('fr', 'modes.puzzles.description'),
      'Résous des problèmes et entraîne tes finales.',
    );
    assert.equal(
      translate('fr', 'modes.visualisation.description'),
      'Suis les coups mentalement et repère-les sur l’échiquier.',
    );
    assert.equal(
      translate('fr', 'modes.quiz-ouverture.description'),
      'Reconnais les ouvertures et teste tes connaissances.',
    );
    assert.equal(
      translate('fr', 'modes.parties.description'),
      'Classe tes parties, rejoue-les et analyse les positions qui t’intéressent.',
    );
  });

  it('uses the specified French category leads', () => {
    assert.equal(
      translate('fr', 'openings.hubLead'),
      'Découvre tes ouvertures, puis entraîne-toi à retrouver les bons coups.',
    );
    assert.equal(
      translate('fr', 'blind.hubLead'),
      'Travaille ta mémoire en retenant des suites de coups à l’oreille ou à l’œil.',
    );
    assert.equal(
      translate('fr', 'puzzle.hubLead'),
      'Résous des problèmes, entraîne tes finales et apprends à défendre une position.',
    );
    assert.equal(
      translate('fr', 'vision.subtitle'),
      'Exerce-toi à suivre les coups et à visualiser les positions.',
    );
    assert.equal(
      translate('fr', 'quiz.subtitle'),
      'Découvre les ouvertures et teste tes connaissances sur les échecs.',
    );
    assert.equal(
      translate('fr', 'parties.subtitle'),
      'Classe tes parties, rejoue-les et analyse les positions qui t’intéressent.',
    );
  });

  it('uses the specified French mode-card descriptions', () => {
    assert.equal(
      translate('fr', 'openings.hubReviewHint'),
      'Retrouve les bons coups de tes ouvertures.',
    );
    assert.equal(
      translate('fr', 'openings.hubLearnHint'),
      'Parcours tes ouvertures à ton rythme, coup par coup.',
    );
    assert.equal(
      translate('fr', 'blind.listenReconstructDesc'),
      'Écoute des coups, puis rejoue-les dans le bon ordre.',
    );
    assert.equal(
      translate('fr', 'blind.watchReciteDesc'),
      'Regarde des coups, puis récite-les à voix haute.',
    );
    assert.equal(translate('fr', 'puzzle.visualCardTitle'), 'Problèmes visuels');
    assert.equal(
      translate('fr', 'puzzle.visualCardDesc'),
      'Trouve la solution directement sur l’échiquier.',
    );
    assert.equal(
      translate('fr', 'puzzle.blindCardDesc'),
      'Trouve la solution sans voir toute la position.',
    );
    assert.equal(
      translate('fr', 'quiz.defendsNulleDesc'),
      'Tiens une position égale face à Stockfish.',
    );
    assert.equal(
      translate('fr', 'quiz.theoreticalEndgameDesc'),
      'Choisis une finale et entraîne-toi à la jouer.',
    );
    assert.equal(
      translate('fr', 'vision.mentalDesc'),
      'Suis les coups de tête, puis retrouve la position.',
    );
    assert.equal(translate('fr', 'vision.nommerDesc'), 'Regarde un coup et donne son nom.');
    assert.equal(translate('fr', 'vision.jouerDesc'), 'Lis un coup et joue-le sur l’échiquier.');
    assert.equal(
      translate('fr', 'quiz.quelleDesc'),
      'Devine l’ouverture à partir des coups joués.',
    );
    assert.equal(
      translate('fr', 'quiz.cultureDesc'),
      'Réponds à des questions sur le monde des échecs.',
    );
  });

  it('keeps matching English hub copy without internal jargon', () => {
    assert.match(translate('en', 'modes.classic.description'), /board|voice/i);
    assert.doesNotMatch(translate('fr', 'quiz.subtitle'), /ECO|pool|Stockfish \(1/);
    assert.doesNotMatch(translate('en', 'quiz.subtitle'), /ECO|pool|Stockfish \(1/);
    assert.doesNotMatch(translate('fr', 'quiz.quelleDesc'), /ECO/);
    assert.doesNotMatch(translate('en', 'quiz.quelleDesc'), /ECO/);
    assert.doesNotMatch(translate('fr', 'blind.hubLead'), /Stockfish|1 à 20|1 to 20/);
    assert.doesNotMatch(translate('en', 'blind.hubLead'), /Stockfish|1 à 20|1 to 20/);
    assert.doesNotMatch(translate('fr', 'openings.hubReviewHint'), /pool|PGN actifs/);
    assert.doesNotMatch(translate('en', 'openings.hubReviewHint'), /pool|active PGNs/);
  });
});

describe('shared hub structure', () => {
  it('keeps Tactical, Vision and Culture on HubScreen', () => {
    assert.match(read('components/puzzles/PuzzleHubPhase.tsx'), /HubScreen/);
    assert.match(read('app/visualisation/index.tsx'), /HubScreen/);
    assert.match(read('app/quiz-ouverture/index.tsx'), /HubScreen/);
  });

  it('harmonizes Memorization and Openings with the same title + lead hierarchy', () => {
    const blind = read('components/blind/BlindHubPhase.tsx');
    assert.match(blind, /HubScreen/);
    assert.match(blind, /blind\.hubLead/);
    assert.doesNotMatch(blind, /ModeScreenShell/);

    const openings = read('app/openings/index.tsx');
    assert.match(openings, /HubIntro/);
    assert.match(openings, /openings\.hubLead/);
    assert.match(openings, /openings-manage-pgn-btn/);
    assert.match(
      openings,
      /<ScreenHeader onBack=\{\(\) => router\.back\(\)\} backTestID="openings-back" \/>/,
    );
  });

  it('shows Analyses de parties with a wrapping header title', () => {
    const parties = read('app/parties/index.tsx');
    assert.match(parties, /parties\.title/);
    assert.match(parties, /titleNumberOfLines=\{2\}/);
    assert.match(parties, /backTestID="parties-back"/);
    assert.doesNotMatch(parties, /<HubIntro/);
  });

  it('lets hub cards wrap their description beside a reserved mascot or icon', () => {
    const card = read('components/HubModeCard.tsx');
    assert.doesNotMatch(card, /numberOfLines/);
    assert.match(card, /flexShrink:\s*0/);
    assert.match(card, /minWidth:\s*0/);
  });
});
