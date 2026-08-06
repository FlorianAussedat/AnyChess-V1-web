export { openingAliasRepository, OpeningAliasRepository } from './OpeningAliasRepository.ts';
export { normalizeOpeningName } from './OpeningNameNormalizer.ts';
export { validateOpeningAnswer } from './OpeningAnswerValidator.ts';
export {
  availableOpeningQuizLines,
  pickOpeningQuizLine,
  pickRandomVariation,
  openingFamilyNames,
  openingFamilyCount,
  openingVariationCount,
  variationsForFamily,
} from './OpeningQuizSelector.ts';
export { OpeningIdentificationSession } from './OpeningIdentificationSession.ts';
export {
  openingTargets,
  openingTargetsForFamily,
  findOpeningTarget,
  lineStopsAtDefiningPosition,
} from './OpeningLineBuilder.ts';
export { matchOpeningMove } from './OpeningTargetMatcher.ts';
export {
  OpeningConstructionSession,
} from './OpeningConstructionSession.ts';
export type { OpeningQuizLine } from './OpeningQuizSelector.ts';
export type { OpeningIdentificationSnapshot } from './OpeningIdentificationSession.ts';
export type { OpeningTarget } from './OpeningLineBuilder.ts';
export type {
  ConstructionSnapshot,
  ConstructionPhase,
  PlayerConstructionSnapshot,
} from './OpeningConstructionSession.ts';
export { groupOpeningSans } from './groupOpeningSans.ts';
export type { OpeningMoveRow } from './groupOpeningSans.ts';
