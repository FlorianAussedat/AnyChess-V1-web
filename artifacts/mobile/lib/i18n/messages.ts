/**
 * Lightweight UI string dictionaries (FR / EN).
 * Chess notation is independent — see lib/chess/notation.ts.
 */
import type { AppLanguage } from '../preferences/types.ts';

export type MessageKey =
  // Nav / common
  | 'nav.home'
  | 'nav.records'
  | 'nav.profil'
  | 'nav.utilisateur'
  | 'nav.parametres'
  | 'common.back'
  | 'common.close'
  | 'common.cancel'
  | 'common.confirm'
  | 'common.validate'
  | 'common.reset'
  | 'common.erase'
  | 'common.save'
  | 'common.continue'
  | 'common.retry'
  | 'common.newGame'
  | 'common.restart'
  | 'common.return'
  | 'common.loading'
  | 'common.error'
  | 'common.correct'
  | 'common.incorrect'
  | 'common.white'
  | 'common.black'
  | 'common.whites'
  | 'common.blacks'
  | 'common.random'
  | 'common.start'
  | 'common.selectAll'
  | 'difficulty.debutant'
  | 'difficulty.confirme'
  | 'difficulty.expert'
  | 'difficulty.grandMaitre'
  | 'game.repeat'
  | 'game.undoAction'
  | 'game.summary'
  | 'game.newShort'
  | 'game.youPlay'
  | 'openings.noPgnFiles'
  | 'openings.pgnFileCount'
  | 'openings.mixedTitle'
  | 'openings.launchGame'
  | 'openings.repertoireNamed'
  | 'openings.playModalHint'
  | 'openings.review'
  | 'openings.reviewHint'
  | 'openings.reviewAll'
  | 'openings.reviewWhite'
  | 'openings.reviewBlack'
  | 'openings.customSelection'
  | 'openings.sideTitle'
  | 'openings.sidePrompt'
  // Profile
  | 'profil.title'
  | 'profil.localData'
  | 'profil.sectionProfile'
  | 'profil.sectionMyData'
  | 'profil.sectionPreferences'
  | 'profil.sectionSave'
  | 'profil.username'
  | 'profil.usernamePlaceholder'
  | 'profil.rapid'
  | 'profil.blitz'
  | 'profil.bullet'
  | 'profil.years'
  | 'profil.pseudoUnset'
  | 'profil.repertoires'
  | 'profil.repertoiresNone'
  | 'profil.repertoiresCount'
  | 'profil.records'
  | 'profil.recordsSee'
  | 'profil.language'
  | 'profil.notation'
  | 'profil.notationFr'
  | 'profil.notationEn'
  | 'profil.voice'
  | 'profil.coordinates'
  | 'profil.voiceSpeed'
  | 'profil.saveTitle'
  | 'profil.saveBody'
  | 'profil.saveSoon'
  | 'profil.resetPrefs'
  | 'profil.resetPrefsTitle'
  | 'profil.resetPrefsBody'
  | 'profil.resetRecords'
  | 'profil.resetRecordsTitle'
  | 'profil.resetRecordsBody'
  | 'profil.cancel'
  | 'profil.reset'
  | 'profil.erase'
  | 'profil.save'
  | 'profil.close'
  | 'profil.langFr'
  | 'profil.langEn'
  | 'utilisateur.title'
  | 'settings.title'
  | 'settings.dictationPace'
  | 'settings.dictationPaceHint'
  | 'settings.dictationPaceDesc'
  | 'settings.paceSlow'
  | 'settings.paceQuiteSlow'
  | 'settings.paceMedium'
  | 'settings.paceQuiteFast'
  | 'settings.paceFast'
  // Modes
  | 'modes.classic.title'
  | 'modes.classic.description'
  | 'modes.openings.title'
  | 'modes.openings.description'
  | 'modes.blind.title'
  | 'modes.blind.description'
  | 'modes.puzzles.title'
  | 'modes.puzzles.description'
  | 'modes.visualisation.title'
  | 'modes.visualisation.description'
  | 'modes.quiz-ouverture.title'
  | 'modes.quiz-ouverture.description'
  | 'modes.parties.title'
  | 'modes.parties.description'
  | 'parties.title'
  | 'parties.subtitle'
  | 'parties.importPgn'
  | 'parties.empty'
  | 'parties.noMeta'
  | 'parties.moveCount'
  | 'parties.importOk'
  | 'parties.importDuplicates'
  | 'parties.importSkipped'
  | 'parties.importNone'
  | 'parties.importFailed'
  | 'parties.deleteTitle'
  | 'parties.deleteConfirm'
  | 'parties.reader'
  | 'parties.play'
  | 'parties.pause'
  | 'parties.prev'
  | 'parties.next'
  | 'parties.start'
  | 'parties.end'
  | 'parties.repeat'
  | 'parties.hideMoves'
  | 'parties.showMoves'
  | 'parties.interval'
  | 'parties.progress'
  | 'parties.endOfGame'
  | 'parties.backToLibrary'
  | 'parties.notFound'
  | 'parties.loading'
  // Game shared
  | 'game.movesPlayed'
  | 'game.exportPgn'
  | 'game.export'
  | 'game.yourTurn'
  | 'game.opponentThinking'
  | 'game.opponentPreparing'
  | 'game.unrecognized'
  | 'game.ambiguous'
  | 'game.illegal'
  | 'game.heard'
  | 'game.configure'
  | 'game.composeOrDictate'
  | 'game.startsHere'
  | 'game.check'
  | 'game.checkmate'
  | 'game.stalemate'
  | 'game.draw'
  | 'game.drawRepetition'
  | 'game.drawMaterial'
  | 'game.gameOver'
  | 'game.undoToStartStatus'
  | 'game.undoToStartSpeak'
  | 'game.undoOpponentSpeak'
  | 'game.sideToMoveWhite'
  | 'game.sideToMoveBlack'
  | 'game.perspectiveWhite'
  | 'game.perspectiveBlack'
  | 'game.playAsWhite'
  | 'game.playAsBlack'
  | 'game.emptyHistory'
  | 'game.promotion'
  | 'keypad.showClassic'
  // Keypad
  | 'keypad.a11y'
  | 'keypad.clear'
  | 'keypad.show'
  | 'keypad.hide'
  | 'keypad.systemOn'
  | 'keypad.systemOff'
  // A11y
  | 'a11y.back'
  | 'a11y.voiceMute'
  | 'a11y.voiceUnmute'
  | 'a11y.boardHide'
  | 'a11y.boardShow'
  | 'a11y.coordsHide'
  | 'a11y.coordsShow'
  | 'a11y.boardHidden'
  | 'a11y.validateMove'
  | 'a11y.randomCamp'
  | 'a11y.moveRecognized'
  | 'a11y.listening'
  | 'a11y.speak'
  | 'a11y.fullMoves'
  | 'a11y.speed'
  | 'a11y.voiceSpeed'
  | 'a11y.pgnEnable'
  | 'a11y.pgnDisable'
  | 'a11y.questionCorrect'
  | 'a11y.questionIncorrect'
  | 'a11y.illustration'
  | 'a11y.errorDetails'
  | 'a11y.closeErrorDetails'
  // Errors / empty
  | 'errors.generic'
  | 'errors.tryAgain'
  | 'errors.notFoundTitle'
  | 'errors.notFoundBody'
  | 'errors.goHome'
  | 'errors.noPgn'
  | 'errors.noRecords'
  | 'errors.repertoireLoad'
  | 'errors.invalidMove'
  | 'errors.noPuzzle'
  | 'errors.micDenied'
  | 'errors.voiceUnavailable'
  | 'errors.folderNotFound'
  | 'errors.folderEmptyName'
  | 'errors.folderExists'
  | 'errors.pgnEmpty'
  | 'errors.pgnNotFound'
  | 'errors.filePgnNotFound'
  // Openings
  | 'openings.title'
  | 'openings.repertoires'
  | 'openings.new'
  | 'openings.deleteFolderTitle'
  | 'openings.deleteFolderBody'
  | 'openings.deleteFileTitle'
  | 'openings.deleteFileBody'
  | 'openings.import'
  | 'openings.replace'
  | 'openings.exercises'
  | 'openings.playVsRepertoire'
  | 'openings.continueLine'
  | 'openings.folderMissing'
  | 'openings.repertoire'
  | 'openings.theory'
  | 'openings.stockfish'
  | 'openings.viewTheoryLine'
  | 'openings.theoryDeviation'
  | 'openings.theoryComplete'
  | 'openings.leftTheory'
  | 'openings.endOfTheoreticalLine'
  | 'openings.restartLine'
  | 'openings.nextLine'
  | 'openings.continueVsStockfish'
  | 'openings.undoThinkAgain'
  | 'openings.showExpectedMove'
  | 'openings.showFullLine'
  | 'openings.expectedMove'
  | 'openings.theoryCompleteContinuing'
  | 'openings.theoryLineTitle'
  | 'openings.playedMoveHeading'
  | 'openings.availableTheoryMoves'
  | 'openings.close'
  | 'openings.theoryReport'
  | 'openings.theoryReportComplete'
  | 'openings.returnToRepertoire'
  | 'openings.yourTurnContinue'
  | 'openings.lineComplete'
  | 'openings.voiceSpeed'
  | 'openings.startLine'
  | 'openings.positionReached'
  | 'openings.importPgn'
  | 'openings.importModalTitle'
  | 'openings.replaceModalTitle'
  | 'openings.pgnEvent'
  | 'openings.sidePickerTitle'
  // Blind / memorization
  | 'blind.title'
  | 'blind.listenReconstruct'
  | 'blind.listenReconstructDesc'
  | 'blind.watchRecite'
  | 'blind.watchReciteDesc'
  | 'blind.fullMoves'
  | 'blind.generate'
  | 'blind.recitation'
  | 'blind.reconstruction'
  | 'blind.recognized'
  | 'blind.skip'
  | 'blind.hint'
  | 'blind.recitePrompt'
  | 'blind.reconstructPrompt'
  | 'blind.moveSkipped'
  | 'blind.illegal'
  | 'blind.correct'
  | 'blind.moveError'
  | 'blind.expectedMove'
  | 'blind.hintUsed'
  | 'blind.recordListen'
  | 'blind.recordWatch'
  // Puzzles
  | 'puzzle.title'
  | 'puzzle.nextMove'
  | 'puzzle.nextMoveLabel'
  | 'puzzle.sideWhite'
  | 'puzzle.sideBlack'
  | 'puzzle.youPlayWhite'
  | 'puzzle.youPlayBlack'
  | 'puzzle.plyAnnounce'
  | 'puzzle.plyAnnounceNoReply'
  | 'puzzle.solution'
  | 'puzzle.solved'
  | 'puzzle.solvedWithHelp'
  | 'puzzle.illegal'
  | 'puzzle.incorrect'
  | 'puzzle.correct'
  | 'puzzle.repeated'
  | 'puzzle.unsolved'
  | 'puzzle.findMove'
  | 'puzzle.replaying'
  | 'puzzle.hubTitle'
  // Vision / mental
  | 'vision.title'
  | 'vision.subtitle'
  | 'vision.mental'
  | 'vision.mentalDesc'
  | 'vision.nommer'
  | 'vision.nommerDesc'
  | 'vision.jouer'
  | 'vision.jouerDesc'
  | 'vision.incorrectRetry'
  | 'vision.correct'
  | 'vision.records'
  | 'vision.fullMovesHint'
  | 'vision.perspective'
  | 'vision.dictate'
  | 'vision.showBoard'
  | 'vision.sequence'
  | 'vision.questionProgress'
  | 'vision.relisten'
  | 'vision.answerPlaceholder'
  | 'vision.finishedScore'
  | 'vision.helpUsed'
  | 'vision.yourAnswer'
  | 'vision.newSequence'
  | 'vision.nommerIntro'
  | 'vision.jouerIntro'
  | 'vision.lastMovePrompt'
  | 'vision.unrecognizedRetry'
  | 'vision.nommerPlaceholder'
  | 'vision.namedCorrect'
  | 'vision.playedCorrect'
  | 'vision.currentRecord'
  | 'vision.viewRecords'
  | 'vision.scoreLabel'
  | 'vision.scoreHeading'
  | 'vision.newRecord'
  | 'vision.wrongCount'
  | 'vision.recordValue'
  // Quiz
  | 'quiz.title'
  | 'quiz.subtitle'
  | 'quiz.quiz'
  | 'quiz.culture'
  | 'quiz.cultureDesc'
  | 'quiz.cultureMixed'
  | 'quiz.quelle'
  | 'quiz.quelleDesc'
  | 'quiz.construis'
  | 'quiz.construisDesc'
  | 'quiz.incorrect'
  | 'quiz.correct'
  | 'quiz.played'
  | 'quiz.expected'
  | 'quiz.goodAnswer'
  | 'quiz.badAnswer'
  | 'quiz.correctWas'
  | 'quiz.wasQuestionCorrect'
  | 'quiz.nextQuestion'
  | 'quiz.seeResults'
  | 'quiz.finished'
  | 'quiz.noQuestions'
  | 'quiz.score'
  | 'quiz.replay'
  | 'quiz.backToHub'
  | 'quiz.identifyPrompt'
  | 'quiz.openingPlaceholder'
  | 'quiz.selectFamily'
  | 'quiz.selectVariation'
  | 'quiz.selectOpening'
  | 'quiz.stepFamily'
  | 'quiz.stepVariation'
  | 'quiz.correctExclaim'
  | 'quiz.correctFamily'
  | 'quiz.answerIs'
  | 'quiz.newOpening'
  | 'quiz.buildSubtitle'
  | 'quiz.opening'
  | 'quiz.variation'
  | 'quiz.change'
  | 'quiz.yourTurnRestart'
  | 'quiz.replaying'
  | 'quiz.dictatePlaceholder'
  | 'quiz.reviewOpening'
  | 'quiz.unrecognized'
  | 'quiz.ambiguous'
  | 'quiz.constructed'
  // Records
  | 'records.title'
  | 'records.resetTitle'
  | 'records.resetBody'
  | 'records.empty'
  | 'records.cat.tactics'
  | 'records.cat.naming'
  | 'records.cat.play'
  | 'records.cat.blind'
  | 'records.cat.culture'
  | 'records.cat.tacticsDesc'
  | 'records.cat.namingDesc'
  | 'records.cat.playDesc'
  | 'records.cat.blindDesc'
  | 'records.subtitle'
  | 'records.best60'
  | 'records.resetTactics'
  | 'records.emptyTactics'
  | 'records.blindResetBody'
  | 'records.tacticsResetBody'
  | 'records.sessionResetTitle'
  | 'records.sessionResetBody'
  | 'records.blindHint'
  | 'records.puzzleSubtitle'
  | 'records.visionSubtitle'
  | 'records.visionResetTitle'
  | 'records.visionResetBody'
  | 'records.legacyNote'
  | 'openings.emptyTitle'
  | 'openings.emptyBody'
  | 'openings.emptyLead'
  | 'openings.emptySources'
  | 'openings.emptyPurpose'
  | 'openings.sectionWhite'
  | 'openings.sectionBlack'
  | 'openings.sectionUnassigned'
  | 'openings.sectionUnassignedHint'
  | 'openings.newRepertoire'
  | 'openings.renameRepertoire'
  | 'openings.create'
  | 'openings.namePlaceholder'
  | 'openings.renamePlaceholder'
  | 'openings.delete'
  | 'openings.remove'
  | 'openings.removeFileTitle'
  | 'openings.removeFileBody'
  | 'openings.folderHint'
  | 'openings.playVsDesc'
  | 'openings.continueLineDesc'
  | 'openings.managePgn'
  | 'openings.emptyPgnBody'
  | 'openings.filesCount'
  | 'openings.importSideRequired'
  | 'openings.fileReadError'
  | 'openings.preparing'
  | 'openings.preparingGame'
  | 'openings.loadingRepertoire'
  | 'openings.repertoireThinking'
  | 'openings.followsRepertoire'
  | 'openings.exportBody'
  | 'openings.exportBodyWithTheory'
  | 'openings.status'
  | 'openings.correctMoves'
  | 'openings.failed'
  | 'openings.fromStart'
  | 'openings.replaySameLine'
  | 'openings.newLine'
  | 'openings.voiceSpeedRange'
  | 'openings.slow'
  | 'openings.fast'
  | 'openings.filename'
  | 'openings.pgnContent'
  | 'openings.pickFile'
  | 'openings.importedSummary'
  | 'openings.noValidPositions'
  | 'openings.analyzing'
  | 'openings.disabled'
  | 'openings.importedOn'
  | 'openings.gamesCount'
  | 'openings.positionsCount'
  | 'openings.errorsCount'
  | 'openings.importPartial'
  | 'openings.importSuccess'
  | 'openings.importFailed'
  | 'openings.gamesChapters'
  | 'openings.positionsParsed'
  | 'openings.branches'
  | 'openings.importPartialDetail'
  | 'openings.errorsLabel'
  | 'openings.warningsLabel'
  | 'openings.movePlaceholder'
  | 'openings.folderIdMissing'
  | 'openings.repertoireNotFound'
  | 'openings.noSideAssigned'
  | 'openings.noPlayablePositions'
  | 'openings.noWhiteToReview'
  | 'openings.noBlackToReview'
  | 'openings.noToReview'
  | 'openings.mixedPickFailed'
  | 'openings.startFailed'
  | 'openings.ambiguousRetry'
  | 'openings.unrecognizedRetry'
  | 'openings.notPlayable'
  | 'openings.okMove'
  | 'openings.opening'
  | 'openings.playEmpty'
  | 'openings.yourMove'
  | 'openings.expectedOnLine'
  | 'openings.proposedContinuation'
  | 'openings.none'
  | 'openings.endOfLine'
  | 'openings.incorrectSpeak'
  | 'openings.continueSpeak'
  | 'openings.continueFromStartSpeak'
  | 'blind.hubLead'
  | 'blind.record'
  | 'blind.recordZero'
  | 'blind.perspective'
  | 'blind.perspectiveHint'
  | 'blind.fullMovesEq'
  | 'blind.maximum'
  | 'blind.speedLabel'
  | 'blind.slow'
  | 'blind.fast'
  | 'blind.speedSlowHint'
  | 'blind.speedFastHint'
  | 'blind.speedDefaultHint'
  | 'blind.oralDictation'
  | 'blind.visualObservation'
  | 'blind.moveProgress'
  | 'blind.dictation'
  | 'blind.dictationListen'
  | 'blind.dictationInProgress'
  | 'blind.dictationDone'
  | 'blind.yourTurn'
  | 'blind.replaySequence'
  | 'blind.startReconstruction'
  | 'blind.observation'
  | 'blind.observationHint'
  | 'blind.observationProgress'
  | 'blind.sequenceDone'
  | 'blind.yourTurnRecite'
  | 'blind.goToRecitation'
  | 'blind.result'
  | 'blind.withoutHelp'
  | 'blind.withError'
  | 'blind.succeeded'
  | 'blind.newRecord'
  | 'blind.recordLine'
  | 'blind.recordIneligible'
  | 'blind.replaying'
  | 'blind.finalPosition'
  | 'blind.detail'
  | 'blind.correctFirstTry'
  | 'blind.wrongPiece'
  | 'blind.wrongDestination'
  | 'blind.wrongOrder'
  | 'blind.helpsUsed'
  | 'blind.wrongMove'
  | 'blind.recognitionFailures'
  | 'blind.retrySame'
  | 'blind.reviewSequence'
  | 'blind.newSequence'
  | 'blind.exercisesMenu'
  | 'blind.movePlaceholder'
  | 'puzzle.hubLead'
  | 'puzzle.mode'
  | 'puzzle.visual'
  | 'puzzle.blind'
  | 'puzzle.difficulty'
  | 'puzzle.visualCardTitle'
  | 'puzzle.visualCardDesc'
  | 'puzzle.blindCardTitle'
  | 'puzzle.blindCardDesc'
  | 'puzzle.difficultyDefaultHint'
  | 'settings.problemDifficulty'
  | 'settings.visualProblemDifficulty'
  | 'settings.blindProblemDifficulty'
  | 'puzzle.randomAll'
  | 'puzzle.pieceCount'
  | 'puzzle.startBlind'
  | 'puzzle.startVisual'
  | 'puzzle.chooseMode'
  | 'puzzle.noMatch'
  | 'puzzle.noMatchBlind'
  | 'puzzle.meta'
  | 'puzzle.streak'
  | 'puzzle.whitePieces'
  | 'puzzle.blackPieces'
  | 'puzzle.repeat'
  | 'puzzle.soundOff'
  | 'puzzle.result'
  | 'puzzle.solutionConsulted'
  | 'puzzle.wrongMoves'
  | 'puzzle.recognitionErrors'
  | 'puzzle.hintsUsed'
  | 'puzzle.nextPuzzle'
  | 'puzzle.retryPuzzle'
  | 'puzzle.replaySolution'
  | 'puzzle.menu'
  | 'puzzle.movePlaceholder'
  | 'puzzle.all'

type Dict = Record<MessageKey, string>;

const fr: Dict = {
  'nav.home': 'Accueil',
  'nav.records': 'Records',
  'nav.profil': 'Profil',
  'nav.utilisateur': 'Utilisateur',
  'nav.parametres': 'Paramètres',
  'common.back': 'Retour',
  'common.close': 'Fermer',
  'common.cancel': 'Annuler',
  'common.confirm': 'Confirmer',
  'common.validate': 'Valider',
  'common.reset': 'Réinitialiser',
  'common.erase': 'Effacer',
  'common.save': 'Enregistrer',
  'common.continue': 'Continuer',
  'common.retry': 'Réessayer',
  'common.newGame': 'Nouvelle partie',
  'common.restart': 'Recommencer',
  'common.return': 'Retour',
  'common.loading': 'Chargement…',
  'common.error': 'Erreur',
  'common.correct': 'Correct',
  'common.incorrect': 'Incorrect',
  'common.white': 'Blancs',
  'common.black': 'Noirs',
  'common.whites': 'Blancs',
  'common.blacks': 'Noirs',
  'common.random': 'Aléatoire',
  'common.start': 'Commencer',
  'common.selectAll': 'Tout sélectionner',
  'difficulty.debutant': 'Débutant',
  'difficulty.confirme': 'Confirmé',
  'difficulty.expert': 'Expert',
  'difficulty.grandMaitre': 'Grand-Maître',
  'game.repeat': 'Répéter',
  'game.undoAction': 'Annuler',
  'game.summary': 'Résumé',
  'game.newShort': 'Nouvelle',
  'game.youPlay': 'Tu joues :',
  'openings.noPgnFiles': 'Aucun fichier PGN',
  'openings.pgnFileCount': '{{count}} fichier(s) PGN',
  'openings.mixedTitle': 'Répertoires à mélanger',
  'openings.launchGame': 'Lancer une partie',
  'openings.repertoireNamed': 'Répertoire : {{name}}',
  'openings.playModalHint':
    "L’échiquier s’oriente selon le côté enregistré pour ce répertoire.\n\nL’adversaire suit ton répertoire tant que tu restes dans la théorie. Dès que tu en sors, Stockfish prend le relais.",
  'openings.review': 'Révision',
  'openings.reviewHint':
    'Continue la ligne sur un ou plusieurs répertoires — l’orientation suit le côté de chaque ligne.',
  'openings.reviewAll': 'Tout réviser',
  'openings.reviewWhite': 'Réviser Blancs',
  'openings.reviewBlack': 'Réviser Noirs',
  'openings.customSelection': 'Sélection personnalisée…',
  'openings.sideTitle': 'Côté du répertoire',
  'openings.sidePrompt': 'De quel côté travaillez-vous « {{name}} » ?',
  'profil.title': 'Profil',
  'profil.localData': 'Données locales — aucun compte requis',
  'profil.sectionProfile': 'PROFIL',
  'profil.sectionMyData': 'MES DONNÉES',
  'profil.sectionPreferences': 'PRÉFÉRENCES',
  'profil.sectionSave': 'SAUVEGARDE',
  'profil.username': 'Pseudo',
  'profil.usernamePlaceholder': 'Ton pseudo',
  'profil.rapid': 'Niveau Rapide',
  'profil.blitz': 'Niveau Blitz',
  'profil.bullet': 'Niveau Bullet',
  'profil.years': 'Années de pratique',
  'profil.pseudoUnset': 'Pseudo non renseigné',
  'profil.repertoires': 'Répertoires PGN',
  'profil.repertoiresNone': 'Aucun',
  'profil.repertoiresCount': '{{count}} répertoire(s)',
  'profil.records': 'Records',
  'profil.recordsSee': 'Voir mes records',
  'profil.language': "Langue de l'application",
  'profil.notation': 'Notation des échecs',
  'profil.notationFr': 'Française',
  'profil.notationEn': 'Anglaise / Internationale',
  'profil.voice': 'Voix / son',
  'profil.coordinates': 'Coordonnées',
  'profil.voiceSpeed': 'Vitesse de la voix',
  'profil.saveTitle': 'Données enregistrées sur cet appareil',
  'profil.saveBody':
    'Profil, répertoires PGN, records et préférences restent locaux. Aucun compte ni cloud pour le moment.',
  'profil.saveSoon': 'Synchronisation multi-appareils — bientôt disponible',
  'profil.resetPrefs': 'Réinitialiser les préférences',
  'profil.resetPrefsTitle': 'Réinitialiser les préférences ?',
  'profil.resetPrefsBody':
    "Les réglages de l'application seront restaurés par défaut. Votre profil, vos répertoires PGN et vos records seront conservés.",
  'profil.resetRecords': 'Réinitialiser les records',
  'profil.resetRecordsTitle': 'Réinitialiser les records ?',
  'profil.resetRecordsBody':
    'Cette action supprime vos records et séries enregistrés. Vos répertoires PGN, préférences et profil seront conservés.',
  'profil.cancel': 'Annuler',
  'profil.reset': 'Réinitialiser',
  'profil.erase': 'Effacer',
  'profil.save': 'Enregistrer',
  'profil.close': 'Fermer',
  'profil.langFr': 'Français',
  'profil.langEn': 'English',
  'utilisateur.title': 'Utilisateur',
  'settings.title': 'Paramètres',
  'settings.dictationPace': "Rythme d'énonciation des coups",
  'settings.dictationPaceHint':
    "Le rythme d'énonciation peut être modifié dans Paramètres.",
  'settings.dictationPaceDesc':
    "Définit le temps d'attente entre deux coups annoncés.",
  'settings.paceSlow': 'Lent — 5 s',
  'settings.paceQuiteSlow': 'Assez lent — 4 s',
  'settings.paceMedium': 'Moyen — 3 s',
  'settings.paceQuiteFast': 'Assez rapide — 2 s',
  'settings.paceFast': 'Rapide — 1 s',
  'modes.classic.title': 'Partie classique',
  'modes.classic.description':
    'Joue une partie, tout simplement ! À la voix ou directement sur l’échiquier.',
  'modes.openings.title': 'Apprends tes ouvertures',
  'modes.openings.description':
    'Apprends et révise tes répertoires d’ouvertures, coup après coup.',
  'modes.blind.title': 'Mémorisation',
  'modes.blind.description':
    'Entraîne-toi à retenir des séquences de coups, à l’écoute ou en les observant.',
  'modes.puzzles.title': 'Entraînement tactique',
  'modes.puzzles.description':
    'Résous des positions tactiques, avec ou sans échiquier visible.',
  'modes.visualisation.title': 'Vision de l’échiquier',
  'modes.visualisation.description':
    'Entraîne-toi à suivre une position mentalement et à reconnaître rapidement les coups.',
  'modes.quiz-ouverture.title': 'Culture générale',
  'modes.quiz-ouverture.description':
    'Teste tes connaissances sur les ouvertures et la culture échiquéenne.',
  'modes.parties.title': 'Lecteur de Parties',
  'modes.parties.description':
    'Importe des PGN et rejoue-les à vue ou à l’écoute, coup après coup.',
  'parties.title': 'Lecteur de Parties',
  'parties.subtitle': 'Bibliothèque',
  'parties.importPgn': 'Importer un PGN',
  'parties.empty': 'Aucune partie importée. Importe un fichier PGN pour commencer.',
  'parties.noMeta': 'Métadonnées indisponibles',
  'parties.moveCount': '{{count}} demi-coups',
  'parties.importOk': '{{count}} partie(s) importée(s)',
  'parties.importDuplicates': '{{count}} déjà présente(s)',
  'parties.importSkipped': '{{count}} ignorée(s)',
  'parties.importNone': 'Aucune nouvelle partie importée',
  'parties.importFailed': 'Échec de l’import PGN',
  'parties.deleteTitle': 'Supprimer la partie ?',
  'parties.deleteConfirm': 'Supprimer',
  'parties.reader': 'Lecteur de Parties',
  'parties.play': 'Lecture',
  'parties.pause': 'Pause',
  'parties.prev': 'Précédent',
  'parties.next': 'Suivant',
  'parties.start': 'Début',
  'parties.end': 'Fin',
  'parties.repeat': 'Répéter le dernier coup',
  'parties.hideMoves': 'Masquer la notation',
  'parties.showMoves': 'Afficher la notation',
  'parties.interval': 'Intervalle',
  'parties.progress': '{{label}} · {{ply}} / {{total}}',
  'parties.endOfGame': 'Fin de la partie · {{result}}',
  'parties.backToLibrary': 'Retour à la bibliothèque',
  'parties.notFound': 'Partie introuvable',
  'parties.loading': 'Chargement…',
  'game.movesPlayed': 'Coups joués',
  'game.exportPgn': 'Exporter en PGN',
  'game.export': 'Exporter',
  'game.yourTurn': 'À toi de jouer.',
  'game.opponentThinking': "L'adversaire réfléchit…",
  'game.opponentPreparing': "L'adversaire prépare son coup…",
  'game.unrecognized': 'Coup non reconnu. Répète.',
  'game.ambiguous': 'Coup ambigu. Précise la case de départ.',
  'game.illegal': 'Coup illégal. Répète.',
  'game.heard': 'Entendu : {{text}}',
  'game.configure': 'Configure la partie',
  'game.composeOrDictate': 'Compose ou dicte le coup',
  'game.startsHere': 'La partie commence ici',
  'game.check': 'Échec.',
  'game.checkmate': 'Échec et mat. Partie terminée.',
  'game.stalemate': 'Pat. Partie nulle.',
  'game.draw': 'Partie nulle.',
  'game.drawRepetition': 'Partie nulle par répétition.',
  'game.drawMaterial': 'Partie nulle, matériel insuffisant.',
  'game.gameOver': 'Partie terminée.',
  'game.undoToStartStatus': 'À toi de jouer.',
  'game.undoToStartSpeak': 'Coup annulé. Début de la partie.',
  'game.undoOpponentSpeak':
    "Coup annulé. Dernier coup de l'adversaire : {{move}}",
  'game.sideToMoveWhite': 'Trait aux Blancs',
  'game.sideToMoveBlack': 'Trait aux Noirs',
  'game.perspectiveWhite': 'Vision côté Blancs',
  'game.perspectiveBlack': 'Vision côté Noirs',
  'game.playAsWhite': 'Je joue Blancs',
  'game.playAsBlack': 'Je joue Noirs',
  'game.emptyHistory': 'Aucun coup joué pour le moment.',
  'game.promotion': 'Promotion',
  'keypad.showClassic': 'Mode classique / manuel',
  'keypad.a11y': 'Clavier coups d’échecs',
  'keypad.clear': 'Eff',
  'keypad.show': 'Afficher le clavier coups d’échecs',
  'keypad.hide': 'Masquer le clavier coups d’échecs',
  'keypad.systemOn': 'Revenir au clavier coups d’échecs',
  'keypad.systemOff': 'Utiliser le clavier système',
  'a11y.back': 'Retour',
  'a11y.voiceMute': 'Couper la voix',
  'a11y.voiceUnmute': 'Activer la voix',
  'a11y.boardHide': 'Masquer l’échiquier',
  'a11y.boardShow': 'Afficher l’échiquier',
  'a11y.coordsHide': 'Masquer les coordonnées',
  'a11y.coordsShow': 'Afficher les coordonnées',
  'a11y.boardHidden': 'Échiquier masqué',
  'a11y.validateMove': 'Valider le coup',
  'a11y.randomCamp': 'Camp aléatoire',
  'a11y.moveRecognized': 'Coup reconnu',
  'a11y.listening': 'Écoute…',
  'a11y.speak': 'Parler',
  'a11y.fullMoves': 'Coups complets',
  'a11y.speed': 'Vitesse',
  'a11y.voiceSpeed': 'Vitesse de la voix',
  'a11y.pgnEnable': 'Activer ce PGN',
  'a11y.pgnDisable': 'Désactiver ce PGN',
  'a11y.questionCorrect': 'Question correcte',
  'a11y.questionIncorrect': 'Question incorrecte',
  'a11y.illustration': 'Illustration',
  'a11y.errorDetails': 'Voir les détails de l’erreur',
  'a11y.closeErrorDetails': 'Fermer les détails de l’erreur',
  'errors.generic': 'Une erreur est survenue',
  'errors.tryAgain': 'Réessayer',
  'errors.notFoundTitle': 'Oups !',
  'errors.notFoundBody': 'Cet écran n’existe pas.',
  'errors.goHome': 'Retour à l’accueil',
  'errors.noPgn': 'Aucun PGN importé',
  'errors.noRecords': 'Aucun record pour le moment',
  'errors.repertoireLoad': 'Impossible de charger le répertoire',
  'errors.invalidMove': 'Coup invalide',
  'errors.noPuzzle': 'Aucun problème disponible',
  'errors.micDenied': 'Permission micro refusée',
  'errors.voiceUnavailable': 'Reconnaissance vocale indisponible',
  'errors.folderNotFound': 'Dossier introuvable.',
  'errors.folderEmptyName': 'Le nom du dossier ne peut pas être vide.',
  'errors.folderExists': 'Un dossier nommé « {{name}} » existe déjà.',
  'errors.pgnEmpty': 'Le contenu PGN est vide.',
  'errors.pgnNotFound': 'Fichier PGN introuvable.',
  'errors.filePgnNotFound': 'Fichier PGN introuvable.',
  'openings.title': 'Ouvertures',
  'openings.repertoires': 'Répertoires PGN',
  'openings.new': 'Nouveau',
  'openings.deleteFolderTitle': 'Supprimer le dossier',
  'openings.deleteFolderBody':
    'Supprimer « {{name}} » et tous les PGN qu’il contient ?',
  'openings.deleteFileTitle': 'Supprimer le fichier',
  'openings.deleteFileBody': 'Supprimer « {{name}} » ?',
  'openings.import': 'Importer',
  'openings.replace': 'Remplacer',
  'openings.exercises': 'Exercices',
  'openings.playVsRepertoire': 'Jouer contre le répertoire',
  'openings.continueLine': 'Continue la ligne',
  'openings.folderMissing': 'Dossier introuvable',
  'openings.repertoire': 'Répertoire',
  'openings.theory': 'Théorie',
  'openings.stockfish': 'Stockfish',
  'openings.viewTheoryLine': 'Voir la ligne théorique',
  'openings.theoryDeviation':
    'Vous êtes sorti de la théorie avec {{move}}.',
  'openings.theoryComplete': 'Ligne théorique complète.',
  'openings.leftTheory': 'Vous êtes sorti de la théorie.',
  'openings.endOfTheoreticalLine': 'Fin de cette ligne théorique',
  'openings.restartLine': 'Recommencer la même ligne',
  'openings.nextLine': 'Ligne suivante',
  'openings.continueVsStockfish': 'Continuer vs Stockfish · {{level}}',
  'openings.undoThinkAgain': 'Annuler mon dernier coup et réfléchir',
  'openings.showExpectedMove': 'Voir le coup attendu',
  'openings.showFullLine': 'Voir la ligne complète',
  'openings.expectedMove': 'Coup attendu : {{move}}',
  'openings.theoryCompleteContinuing': 'Théorie terminée · Suite vs Stockfish',
  'openings.theoryLineTitle': 'Ligne théorique',
  'openings.playedMoveHeading': 'Votre coup',
  'openings.availableTheoryMoves': 'Coups théoriques disponibles',
  'openings.close': 'Fermer',
  'openings.theoryReport': 'Rapport : {{message}}',
  'openings.theoryReportComplete':
    'Rapport : ligne théorique importée suivie jusqu’à son terme.',
  'openings.returnToRepertoire': 'Retour au répertoire',
  'openings.yourTurnContinue': 'À toi de continuer',
  'openings.lineComplete': 'Ligne complète',
  'openings.voiceSpeed': 'Vitesse de la voix',
  'openings.startLine': 'Ligne de départ',
  'openings.positionReached': 'Position atteinte',
  'openings.importPgn': 'Importer un PGN',
  'openings.importModalTitle': 'Importer un PGN',
  'openings.replaceModalTitle': 'Remplacer le PGN',
  'openings.pgnEvent': 'AnyChess — Ouvertures',
  'openings.sidePickerTitle': 'Quel camp joues-tu ?',
  'blind.title': 'Mémorisation',
  'blind.listenReconstruct': 'Écouter puis reconstruire',
  'blind.listenReconstructDesc':
    'Écoute une séquence, puis reconstitue-la coup par coup.',
  'blind.watchRecite': 'Regarder puis réciter',
  'blind.watchReciteDesc':
    'Observe une séquence, puis récite-la à voix haute.',
  'blind.fullMoves': 'Coups complets',
  'blind.generate': 'Générer la séquence',
  'blind.recitation': 'Récitation',
  'blind.reconstruction': 'Reconstruction',
  'blind.recognized': 'Reconnu : {{san}}',
  'blind.skip': 'Passer',
  'blind.hint': 'Aide',
  'blind.recitePrompt': 'Dis le prochain coup à voix haute.',
  'blind.reconstructPrompt': 'Reproduis le prochain coup.',
  'blind.moveSkipped': 'Coup passé.',
  'blind.illegal': 'Coup illégal.',
  'blind.correct': 'Correct.',
  'blind.moveError': 'Erreur de coup',
  'blind.expectedMove': 'Coup attendu : {{move}}',
  'blind.hintUsed': 'Aide utilisée',
  'blind.recordListen': 'Record écoute/reconstruction',
  'blind.recordWatch': 'Record vision/récitation',
  'puzzle.title': 'Entraînement tactique',
  'puzzle.nextMove': 'Coup suivant : {{san}}',
  'puzzle.nextMoveLabel': 'Coup suivant',
  'puzzle.sideWhite': 'Trait aux Blancs.',
  'puzzle.sideBlack': 'Trait aux Noirs.',
  'puzzle.youPlayWhite': 'Vous jouez les Blancs',
  'puzzle.youPlayBlack': 'Vous jouez les Noirs',
  'puzzle.plyAnnounce': '{{user}} joué. L’adversaire joue {{opponent}}.',
  'puzzle.plyAnnounceNoReply': '{{user}} joué.',
  'puzzle.solution': 'Solution',
  'puzzle.solved': 'Problème résolu',
  'puzzle.solvedWithHelp': 'Problème résolu avec aide',
  'puzzle.illegal': 'Coup illégal.',
  'puzzle.incorrect': 'Coup incorrect. Réessaie.',
  'puzzle.correct': 'Correct.',
  'puzzle.repeated': 'Position répétée.',
  'puzzle.unsolved': 'Problème non résolu',
  'puzzle.findMove': 'À toi de trouver le coup.',
  'puzzle.replaying': 'Relecture…',
  'puzzle.hubTitle': 'Entraînement tactique',
  'vision.title': 'Vision de l’échiquier',
  'vision.subtitle':
    'Trois exercices pour entraîner le suivi mental et la reconnaissance rapide de coups.',
  'vision.mental': 'Suivi mental de position',
  'vision.mentalDesc':
    'Suis une séquence de coups, puis réponds à des questions sur la position obtenue.',
  'vision.nommer': 'Nommer le coup',
  'vision.nommerDesc': 'Identifie le plus rapidement possible le coup joué sur l’échiquier.',
  'vision.jouer': 'Jouer le coup',
  'vision.jouerDesc': 'Joue le plus rapidement possible le coup donné.',
  'vision.incorrectRetry': 'Incorrect — réessaie',
  'vision.correct': 'Correct',
  'vision.records': 'Records',
  'vision.fullMovesHint': '{{full}} coups complets = {{half}} demi-coups',
  'vision.perspective': 'PERSPECTIVE',
  'vision.dictate': 'Dicter la séquence',
  'vision.showBoard': 'Afficher l’échiquier pendant la séquence',
  'vision.sequence': 'Séquence',
  'vision.questionProgress': 'Question {{current}} / {{total}}',
  'vision.relisten': 'Réécouter la séquence',
  'vision.answerPlaceholder': 'Réponse écrite…',
  'vision.finishedScore': 'Terminé — score {{score}}/{{total}}',
  'vision.helpUsed': ' · aide utilisée',
  'vision.yourAnswer': 'Ta réponse : {{answer}}',
  'vision.newSequence': 'Nouvelle séquence',
  'vision.nommerIntro':
    'Identifie autant de coups que possible en 60 secondes. Pas de limite de temps par question.',
  'vision.jouerIntro':
    'Joue le coup demandé sur l’échiquier, le plus rapidement possible, pendant 60 secondes.',
  'vision.lastMovePrompt': 'Quel était le dernier coup ?',
  'vision.unrecognizedRetry': 'Coup non reconnu — réessaie',
  'vision.nommerPlaceholder': 'ex. Cavalier prend e5',
  'vision.namedCorrect': 'Coups correctement nommés',
  'vision.playedCorrect': 'Coups correctement joués',
  'vision.currentRecord': 'Record actuel : {{record}}',
  'vision.viewRecords': 'Voir les records',
  'vision.scoreLabel': 'Score : {{score}}',
  'vision.scoreHeading': 'SCORE',
  'vision.newRecord': 'Nouveau record !',
  'vision.wrongCount': 'Incorrect : {{count}}',
  'vision.recordValue': 'Record : {{record}}',
  'quiz.title': 'Culture générale',
  'quiz.subtitle':
    'Utilise la base d’ouvertures ECO locale — indépendante de tes répertoires PGN.',
  'quiz.quiz': 'Quiz',
  'quiz.culture': 'Culture échiquéenne',
  'quiz.cultureDesc':
    'Teste ta culture échiquéenne avec des questions variées sur l’histoire, les champions, les règles, les tournois et le monde des échecs.',
  'quiz.cultureMixed': 'Culture échiquéenne — 10 questions mixtes',
  'quiz.quelle': 'Quelle ouverture ?',
  'quiz.quelleDesc':
    'Reconnais le nom de l’ouverture à partir de la ligne jouée (base ECO).',
  'quiz.construis': 'Construis l’ouverture',
  'quiz.construisDesc':
    'Dicte la ligne jusqu’à la position qui identifie l’ouverture demandée.',
  'quiz.incorrect': 'Incorrect.',
  'quiz.correct': 'Correct.',
  'quiz.played': 'Joué : {{moves}}',
  'quiz.expected': 'Attendu : {{san}}',
  'quiz.goodAnswer': 'Bonne réponse',
  'quiz.badAnswer': 'Mauvaise réponse',
  'quiz.correctWas': 'Bonne réponse : {{answer}}',
  'quiz.wasQuestionCorrect': 'Cette question était-elle correcte ?',
  'quiz.nextQuestion': 'Question suivante',
  'quiz.seeResults': 'Voir les résultats',
  'quiz.finished': 'Quiz terminé',
  'quiz.noQuestions': 'Aucune question disponible pour le moment.',
  'quiz.score': 'Score {{correct}} / {{total}}',
  'quiz.replay': 'Rejouer',
  'quiz.backToHub': 'Retour à Culture générale',
  'quiz.identifyPrompt': 'Identifie l’ouverture après cette ligne :',
  'quiz.openingPlaceholder': 'Nom de l’ouverture',
  'quiz.selectFamily': 'Quelle famille d’ouverture ?',
  'quiz.selectVariation': 'Quelle variante ?',
  'quiz.selectOpening': 'Quelle ouverture ?',
  'quiz.stepFamily': 'Étape 1 — Famille',
  'quiz.stepVariation': 'Étape 2 — Variante',
  'quiz.correctExclaim': 'Correct !',
  'quiz.correctFamily': 'Correct (famille acceptée) !',
  'quiz.answerIs': 'Réponse : {{name}}',
  'quiz.newOpening': 'Nouvelle ouverture',
  'quiz.buildSubtitle': 'Joue la ligne de référence exacte, coup par coup.',
  'quiz.opening': 'OUVERTURE',
  'quiz.variation': 'VARIATION',
  'quiz.change': 'Changer',
  'quiz.yourTurnRestart': 'À toi de recommencer',
  'quiz.replaying': 'Relecture de l’ouverture…',
  'quiz.dictatePlaceholder': 'Dicte ou écris le coup',
  'quiz.reviewOpening': 'Revoir l’ouverture',
  'quiz.unrecognized': 'Coup non reconnu.',
  'quiz.ambiguous': 'Ambigu — reformule le coup (non compté comme erreur).',
  'quiz.constructed': 'Ouverture construite !',
  'records.title': 'Records',
  'records.resetTitle': 'Réinitialiser les records ?',
  'records.resetBody':
    'Cette action supprime vos records et séries enregistrés. Vos répertoires PGN, préférences et profil seront conservés.',
  'records.empty': 'Aucun record pour le moment',
  'records.cat.tactics': 'Tactiques',
  'records.cat.naming': 'Nommer le coup',
  'records.cat.play': 'Jouer le coup',
  'records.cat.blind': 'Mémorisation',
  'records.cat.culture': 'Culture',
  'records.cat.tacticsDesc': 'Meilleures séries de problèmes par bande de difficulté',
  'records.cat.namingDesc': 'Meilleur score en 60 secondes (Vision de l’échiquier)',
  'records.cat.playDesc': 'Meilleur score en 60 secondes (Vision de l’échiquier)',
  'records.cat.blindDesc':
    'Meilleur nombre de coups complets à 100 % sans aide ni erreur',
  'records.subtitle': 'Tes meilleurs scores déjà enregistrés sur cet appareil',
  'records.best60': 'Meilleur score / 60 s',
  'records.resetTactics': 'Réinitialiser les records tactiques',
  'records.emptyTactics':
    'Aucun record pour l’instant — résous des problèmes pour en enregistrer.',
  'records.blindResetBody':
    'Cette action remettra à zéro les records Écouter puis reconstruire et Regarder puis réciter.',
  'records.tacticsResetBody':
    'Cette action effacera toutes les meilleures séries enregistrées.',
  'records.sessionResetTitle': 'Réinitialiser le record ?',
  'records.sessionResetBody':
    'Cette action remettra à zéro le meilleur score 60 secondes de {{label}}.',
  'records.blindHint':
    'Meilleur nombre de coups complets à 100 %, sans aide ni erreur.',
  'records.puzzleSubtitle': 'Meilleures séries par bande de difficulté',
  'records.visionSubtitle':
    'Meilleurs scores sur 60 secondes — Vision de l’échiquier',
  'records.visionResetTitle': 'Réinitialiser tous les records ?',
  'records.visionResetBody':
    'Cette action remettra à zéro les records 60 secondes. Les anciens scores par délai (legacy) restent conservés séparément.',
  'records.legacyNote':
    'Anciens records par délai encore présents en stockage (legacy).',
  'openings.emptyTitle': 'Tu n’as pas encore de répertoire',
  'openings.emptyBody':
    'Importe un fichier PGN contenant une ouverture que tu souhaites travailler.',
  'openings.emptyLead':
    'Importe un fichier PGN contenant une ouverture que tu souhaites travailler.',
  'openings.emptySources':
    'Tu peux obtenir ces fichiers depuis ton logiciel d’échecs, une base de parties, un répertoire que tu as créé toi-même, ou un service d’entraînement qui permet l’export en PGN.',
  'openings.emptyPurpose':
    'AnyChess utilisera les variantes de ton fichier pour te les faire rejouer et t’aider à les mémoriser.',
  'openings.sectionWhite': 'RÉPERTOIRE BLANCS',
  'openings.sectionBlack': 'RÉPERTOIRE NOIRS',
  'openings.sectionUnassigned': 'SANS CÔTÉ',
  'openings.sectionUnassignedHint':
    'Ouvre chaque dossier et choisis « Je joue Blancs » ou « Je joue Noirs » à l’import.',
  'openings.newRepertoire': 'Nouveau répertoire',
  'openings.renameRepertoire': 'Renommer le répertoire',
  'openings.create': 'Créer',
  'openings.namePlaceholder': 'Ex. Dragon accéléré',
  'openings.renamePlaceholder': 'Nouveau nom',
  'openings.delete': 'Supprimer',
  'openings.remove': 'Retirer',
  'openings.removeFileTitle': 'Retirer le fichier',
  'openings.removeFileBody':
    'Retirer « {{name}} » de ce répertoire ? Le dossier lui-même sera conservé.',
  'openings.folderHint':
    'Plusieurs PGN dans ce dossier seront fusionnés en un seul arbre de répertoire (transpositions reconnues, doublons évités).',
  'openings.playVsDesc':
    'L’adversaire suit tes lignes importées, puis Stockfish hors livre.',
  'openings.continueLineDesc':
    'Récite la suite d’une branche choisie dans ce répertoire.',
  'openings.managePgn': 'Gérer les PGN',
  'openings.emptyPgnBody':
    'Importe un ou plusieurs fichiers .pgn (collage ou sélection de fichier).',
  'openings.filesCount': '{{count}} fichier(s) PGN',
  'openings.importSideRequired':
    'Indique de quel côté tu travailles ce répertoire.',
  'openings.fileReadError': 'Impossible de lire le fichier.',
  'openings.preparing': 'Préparation…',
  'openings.preparingGame': 'Préparation de la partie…',
  'openings.loadingRepertoire': 'Chargement du répertoire…',
  'openings.repertoireThinking': 'Répertoire…',
  'openings.followsRepertoire': 'L’adversaire suit ton répertoire',
  'openings.exportBody':
    'Inclut les coups, le résultat, ta couleur, le répertoire.',
  'openings.exportBodyWithTheory':
    'Inclut les coups, le résultat, ta couleur, le répertoire et le commentaire de sortie de théorie.',
  'openings.status': 'Statut',
  'openings.correctMoves': 'Coups corrects : {{count}}',
  'openings.failed': 'Erreur — exercice arrêté',
  'openings.fromStart': 'Continue la ligne depuis le début{{side}}.',
  'openings.replaySameLine': 'Rejouer la même ligne',
  'openings.newLine': 'Nouvelle ligne',
  'openings.voiceSpeedRange': 'Vitesse de la voix (1–10)',
  'openings.slow': 'Lent',
  'openings.fast': 'Rapide',
  'openings.filename': 'Nom du fichier',
  'openings.pgnContent': 'Contenu PGN',
  'openings.pickFile': 'Choisir un fichier…',
  'openings.importedSummary':
    'Importé : {{games}} partie(s), {{positions}} position(s)',
  'openings.noValidPositions': 'Aucune position valide importée',
  'openings.analyzing': 'Analyse…',
  'openings.disabled': '(désactivé)',
  'openings.importedOn': 'Importé le {{date}}',
  'openings.gamesCount': '{{count}} partie(s)',
  'openings.positionsCount': '{{count}} position(s)',
  'openings.errorsCount': '{{count}} erreur(s)',
  'openings.importPartial': 'Import partiel',
  'openings.importSuccess': 'Import réussi',
  'openings.importFailed': 'Échec d’import',
  'openings.gamesChapters': 'Parties / chapitres : {{count}}',
  'openings.positionsParsed': 'Positions parsées : {{count}}',
  'openings.branches': 'Branches : {{count}}',
  'openings.importPartialDetail':
    'Import partiel — certaines lignes rejetées',
  'openings.errorsLabel': 'Erreurs ({{count}})',
  'openings.warningsLabel': 'Avertissements ({{count}})',
  'openings.movePlaceholder': 'Ex. e4, Cf3, petit roque…',
  'openings.folderIdMissing': 'Dossier manquant.',
  'openings.repertoireNotFound': 'Répertoire introuvable.',
  'openings.noSideAssigned':
    '« {{name}} » n’a pas de côté enregistré. Ouvre le répertoire et indique Blancs ou Noirs.',
  'openings.noPlayablePositions':
    '« {{name}} » ne contient aucune position jouable.',
  'openings.noWhiteToReview': 'Aucun répertoire Blancs à réviser.',
  'openings.noBlackToReview': 'Aucun répertoire Noirs à réviser.',
  'openings.noToReview': 'Aucun répertoire à réviser.',
  'openings.mixedPickFailed':
    'Impossible de tirer une ligne dans la sélection mixte.',
  'openings.startFailed': 'Impossible de démarrer.',
  'openings.ambiguousRetry':
    'Ambigu — reformule le coup (non compté comme erreur).',
  'openings.unrecognizedRetry':
    'Non reconnu — réessaie (non compté comme erreur).',
  'openings.notPlayable': 'Coup non jouable ici — réessaie.',
  'openings.okMove': 'OK : {{san}}',
  'openings.opening': 'Ouverture',
  'openings.playEmpty':
    'Ce répertoire ne contient aucune position jouable. Importe d’abord un PGN.',
  'openings.yourMove': 'Votre coup : {{move}}',
  'openings.expectedOnLine': 'Coup attendu sur cette ligne :',
  'openings.proposedContinuation': 'Suite proposée :',
  'openings.none': '(aucun)',
  'openings.endOfLine': '(fin de ligne)',
  'openings.incorrectSpeak': 'Incorrect. Votre coup : {{move}}. Suite proposée : {{suite}}',
  'openings.continueSpeak': 'Continue la ligne{{side}}.',
  'openings.continueFromStartSpeak': 'Continue la ligne depuis le début{{side}}.',
  'blind.hubLead':
    'Choisis un exercice. Les séquences sont générées par Stockfish (1 à 20 coups complets).',
  'blind.record': 'Record : {{count}} coups complets',
  'blind.recordZero': 'Record : 0',
  'blind.perspective': 'PERSPECTIVE',
  'blind.perspectiveHint':
    'Les Blancs jouent toujours en premier. 1 coup complet = 1 coup Blanc + 1 coup Noir.',
  'blind.fullMovesEq':
    '{{full}} coups complets = {{half}} demi-coups{{max}}',
  'blind.maximum': ' (maximum)',
  'blind.speedLabel': 'Vitesse ({{min}}–{{max}})',
  'blind.slow': 'Lent',
  'blind.fast': 'Rapide',
  'blind.speedSlowHint': 'Lent — plus de temps entre les coups',
  'blind.speedFastHint': 'Rapide — enchaînement serré',
  'blind.speedDefaultHint': 'Vitesse {{speed}} (défaut {{default}})',
  'blind.oralDictation': ' · dictée orale',
  'blind.visualObservation': ' · observation visuelle',
  'blind.moveProgress': 'Coup {{current}} / {{total}}',
  'blind.dictation': 'Dictée',
  'blind.dictationListen':
    'Écoute les {{total}} demi-coups. Aucune notation affichée.',
  'blind.dictationInProgress': 'Dictée en cours',
  'blind.dictationDone': 'Dictée terminée',
  'blind.yourTurn': 'À ton tour',
  'blind.replaySequence': 'Rejouer la séquence',
  'blind.startReconstruction': 'Commencer la reconstruction',
  'blind.observation': 'Observation',
  'blind.observationHint': 'Regarde la séquence — aucune annonce orale.',
  'blind.observationProgress':
    'Observation · Coup {{current}} / {{total}}',
  'blind.sequenceDone': 'Séquence terminée',
  'blind.yourTurnRecite': 'À ton tour de réciter',
  'blind.goToRecitation': 'Passer à la récitation',
  'blind.result': 'Résultat',
  'blind.withoutHelp': 'Sans aide',
  'blind.withError': 'Avec erreur',
  'blind.succeeded': '{{done}} / {{total}} réussis',
  'blind.newRecord': 'Nouveau record : {{count}} coups complets',
  'blind.recordLine': 'Record : {{count}} coups complets',
  'blind.recordIneligible': 'Record non éligible pour cette tentative',
  'blind.replaying': 'Relecture {{current}} / {{total}}',
  'blind.finalPosition': 'Position finale',
  'blind.detail': 'Détail',
  'blind.correctFirstTry': 'Coups corrects au premier essai',
  'blind.wrongPiece': 'Erreurs de pièce',
  'blind.wrongDestination': 'Erreurs de destination',
  'blind.wrongOrder': 'Erreurs d’ordre',
  'blind.helpsUsed': 'Aides utilisées',
  'blind.wrongMove': 'Erreurs de coup',
  'blind.recognitionFailures':
    'Erreurs de reconnaissance non comptabilisées',
  'blind.retrySame': 'Refaire la même séquence',
  'blind.reviewSequence': 'Revoir la séquence',
  'blind.newSequence': 'Nouvelle séquence',
  'blind.exercisesMenu': 'Menu des exercices',
  'blind.movePlaceholder': 'Ex. e4, Cf3, petit roque…',
  'puzzle.hubLead':
    'Mets ta vision tactique à l’épreuve, avec ou sans échiquier, parmi des milliers de problèmes variés adaptés à tous les niveaux.',
  'puzzle.mode': 'Mode',
  'puzzle.visual': 'Visuel',
  'puzzle.blind': 'À l’aveugle',
  'puzzle.difficulty': 'Difficulté',
  'puzzle.visualCardTitle': 'Problèmes Visuel',
  'puzzle.visualCardDesc': 'Résous des problèmes directement sur l’échiquier.',
  'puzzle.blindCardTitle': 'Problèmes à l’aveugle',
  'puzzle.blindCardDesc': 'Résous des problèmes sans voir la position complète.',
  'puzzle.difficultyDefaultHint':
    'La difficulté par défaut peut être modifiée dans Paramètres.',
  'settings.problemDifficulty': 'DIFFICULTÉ DES PROBLÈMES',
  'settings.visualProblemDifficulty': 'Difficulté problèmes visuels',
  'settings.blindProblemDifficulty': 'Difficulté problèmes à l’aveugle',
  'puzzle.randomAll': 'Aléatoire / Tous',
  'puzzle.pieceCount': 'Nombre de pièces',
  'puzzle.startBlind': 'Commencer à l’aveugle',
  'puzzle.startVisual': 'Commencer en visuel',
  'puzzle.chooseMode': 'Choisir un mode',
  'puzzle.noMatch':
    'Aucun problème ne correspond à ces filtres. Élargis la cote puis réessaie.',
  'puzzle.noMatchBlind':
    'Aucun problème ne correspond à ces filtres. Élargis la cote ou le nombre de pièces puis réessaie.',
  'puzzle.meta':
    '{{id}} · cote {{rating}} (Lichess) · {{side}} · Série : {{streak}}',
  'puzzle.streak': 'Série : {{count}}',
  'puzzle.whitePieces': 'Pièces blanches',
  'puzzle.blackPieces': 'Pièces noires',
  'puzzle.repeat': 'Répéter',
  'puzzle.soundOff': 'Son coupé — relecture visuelle uniquement.',
  'puzzle.result': 'Résultat',
  'puzzle.solutionConsulted': 'Solution consultée',
  'puzzle.wrongMoves': 'Erreurs de coup',
  'puzzle.recognitionErrors': 'Erreurs de reconnaissance',
  'puzzle.hintsUsed': 'Indices utilisés',
  'puzzle.nextPuzzle': 'Problème suivant',
  'puzzle.retryPuzzle': 'Refaire ce problème',
  'puzzle.replaySolution': 'Rejouer la solution',
  'puzzle.menu': 'Menu des problèmes',
  'puzzle.movePlaceholder': 'Ex. Cf3, Fou prend e5, petit roque…',
  'puzzle.all': 'Tous',
};

const en: Dict = {
  'nav.home': 'Home',
  'nav.records': 'Records',
  'nav.profil': 'Profile',
  'nav.utilisateur': 'User',
  'nav.parametres': 'Settings',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.validate': 'Confirm',
  'common.reset': 'Reset',
  'common.erase': 'Clear',
  'common.save': 'Save',
  'common.continue': 'Continue',
  'common.retry': 'Try again',
  'common.newGame': 'New game',
  'common.restart': 'Restart',
  'common.return': 'Back',
  'common.loading': 'Loading…',
  'common.error': 'Error',
  'common.correct': 'Correct',
  'common.incorrect': 'Incorrect',
  'common.white': 'White',
  'common.black': 'Black',
  'common.whites': 'White',
  'common.blacks': 'Black',
  'common.random': 'Random',
  'common.start': 'Start',
  'common.selectAll': 'Select all',
  'difficulty.debutant': 'Beginner',
  'difficulty.confirme': 'Intermediate',
  'difficulty.expert': 'Expert',
  'difficulty.grandMaitre': 'Grandmaster',
  'game.repeat': 'Repeat',
  'game.undoAction': 'Undo',
  'game.summary': 'Summary',
  'game.newShort': 'New',
  'game.youPlay': 'You play:',
  'openings.noPgnFiles': 'No PGN files',
  'openings.pgnFileCount': '{{count}} PGN file(s)',
  'openings.mixedTitle': 'Repertoires to mix',
  'openings.launchGame': 'Start a game',
  'openings.repertoireNamed': 'Repertoire: {{name}}',
  'openings.playModalHint':
    'The board orientation follows the side saved for this repertoire.\n\nThe opponent follows your repertoire while you stay in theory. When you leave it, Stockfish takes over.',
  'openings.review': 'Review',
  'openings.reviewHint':
    'Continue the line across one or more repertoires — orientation follows each line’s side.',
  'openings.reviewAll': 'Review all',
  'openings.reviewWhite': 'Review White',
  'openings.reviewBlack': 'Review Black',
  'openings.customSelection': 'Custom selection…',
  'openings.sideTitle': 'Repertoire side',
  'openings.sidePrompt': 'Which side are you training “{{name}}” as?',
  'profil.title': 'Profile',
  'profil.localData': 'Local data — no account required',
  'profil.sectionProfile': 'PROFILE',
  'profil.sectionMyData': 'MY DATA',
  'profil.sectionPreferences': 'PREFERENCES',
  'profil.sectionSave': 'BACKUP',
  'profil.username': 'Username',
  'profil.usernamePlaceholder': 'Your username',
  'profil.rapid': 'Rapid level',
  'profil.blitz': 'Blitz level',
  'profil.bullet': 'Bullet level',
  'profil.years': 'Years of practice',
  'profil.pseudoUnset': 'Username not set',
  'profil.repertoires': 'PGN repertoires',
  'profil.repertoiresNone': 'None',
  'profil.repertoiresCount': '{{count}} repertoire(s)',
  'profil.records': 'Records',
  'profil.recordsSee': 'View my records',
  'profil.language': 'App language',
  'profil.notation': 'Chess notation',
  'profil.notationFr': 'French',
  'profil.notationEn': 'English / International',
  'profil.voice': 'Voice / sound',
  'profil.coordinates': 'Coordinates',
  'profil.voiceSpeed': 'Voice speed',
  'profil.saveTitle': 'Data saved on this device',
  'profil.saveBody':
    'Profile, PGN repertoires, records and preferences stay local. No account or cloud for now.',
  'profil.saveSoon': 'Multi-device sync — coming soon',
  'profil.resetPrefs': 'Reset preferences',
  'profil.resetPrefsTitle': 'Reset preferences?',
  'profil.resetPrefsBody':
    'App settings will be restored to defaults. Your profile, PGN repertoires and records will be kept.',
  'profil.resetRecords': 'Reset records',
  'profil.resetRecordsTitle': 'Reset records?',
  'profil.resetRecordsBody':
    'This deletes your saved records and streaks. Your PGN repertoires, preferences and profile will be kept.',
  'profil.cancel': 'Cancel',
  'profil.reset': 'Reset',
  'profil.erase': 'Clear',
  'profil.save': 'Save',
  'profil.close': 'Close',
  'profil.langFr': 'Français',
  'profil.langEn': 'English',
  'utilisateur.title': 'User',
  'settings.title': 'Settings',
  'settings.dictationPace': 'Move dictation pace',
  'settings.dictationPaceHint':
    'You can change the move dictation pace in Settings.',
  'settings.dictationPaceDesc':
    'Sets the pause between two announced moves.',
  'settings.paceSlow': 'Slow — 5 s',
  'settings.paceQuiteSlow': 'Quite slow — 4 s',
  'settings.paceMedium': 'Medium — 3 s',
  'settings.paceQuiteFast': 'Quite fast — 2 s',
  'settings.paceFast': 'Fast — 1 s',
  'modes.classic.title': 'Classic game',
  'modes.classic.description':
    'Just play a game — by voice or directly on the board.',
  'modes.openings.title': 'Learn your openings',
  'modes.openings.description':
    'Learn and revise your opening repertoires, move by move.',
  'modes.blind.title': 'Memorization',
  'modes.blind.description':
    'Train to remember move sequences by listening or watching.',
  'modes.puzzles.title': 'Tactical training',
  'modes.puzzles.description':
    'Solve tactical positions, with or without a visible board.',
  'modes.visualisation.title': 'Board vision',
  'modes.visualisation.description':
    'Train to follow a position mentally and recognize moves quickly.',
  'modes.quiz-ouverture.title': 'General knowledge',
  'modes.quiz-ouverture.description':
    'Test your knowledge of openings and chess culture.',
  'modes.parties.title': 'Game Reader',
  'modes.parties.description':
    'Import PGN files and replay them visually or by listening, move by move.',
  'parties.title': 'Game Reader',
  'parties.subtitle': 'Library',
  'parties.importPgn': 'Import a PGN',
  'parties.empty': 'No imported games yet. Import a PGN file to get started.',
  'parties.noMeta': 'No metadata available',
  'parties.moveCount': '{{count}} plies',
  'parties.importOk': '{{count}} game(s) imported',
  'parties.importDuplicates': '{{count}} already present',
  'parties.importSkipped': '{{count}} skipped',
  'parties.importNone': 'No new games imported',
  'parties.importFailed': 'PGN import failed',
  'parties.deleteTitle': 'Delete this game?',
  'parties.deleteConfirm': 'Delete',
  'parties.reader': 'Game Reader',
  'parties.play': 'Play',
  'parties.pause': 'Pause',
  'parties.prev': 'Previous',
  'parties.next': 'Next',
  'parties.start': 'Start',
  'parties.end': 'End',
  'parties.repeat': 'Repeat last move',
  'parties.hideMoves': 'Hide notation',
  'parties.showMoves': 'Show notation',
  'parties.interval': 'Interval',
  'parties.progress': '{{label}} · {{ply}} / {{total}}',
  'parties.endOfGame': 'End of game · {{result}}',
  'parties.backToLibrary': 'Back to library',
  'parties.notFound': 'Game not found',
  'parties.loading': 'Loading…',
  'game.movesPlayed': 'Moves played',
  'game.exportPgn': 'Export PGN',
  'game.export': 'Export',
  'game.yourTurn': 'Your move.',
  'game.opponentThinking': 'Opponent is thinking…',
  'game.opponentPreparing': 'Opponent is preparing a move…',
  'game.unrecognized': 'Move not recognized. Try again.',
  'game.ambiguous': 'Ambiguous move. Specify the from-square.',
  'game.illegal': 'Illegal move. Try again.',
  'game.heard': 'Heard: {{text}}',
  'game.configure': 'Set up the game',
  'game.composeOrDictate': 'Compose or dictate the move',
  'game.startsHere': 'The game starts here',
  'game.check': 'Check.',
  'game.checkmate': 'Checkmate. Game over.',
  'game.stalemate': 'Stalemate. Draw.',
  'game.draw': 'Draw.',
  'game.drawRepetition': 'Draw by repetition.',
  'game.drawMaterial': 'Draw by insufficient material.',
  'game.gameOver': 'Game over.',
  'game.undoToStartStatus': 'Your move.',
  'game.undoToStartSpeak': 'Move undone. Back to the start.',
  'game.undoOpponentSpeak':
    "Move undone. Opponent's last move: {{move}}",
  'game.sideToMoveWhite': 'White to move',
  'game.sideToMoveBlack': 'Black to move',
  'game.perspectiveWhite': 'White’s perspective',
  'game.perspectiveBlack': 'Black’s perspective',
  'game.playAsWhite': 'I play White',
  'game.playAsBlack': 'I play Black',
  'game.emptyHistory': 'No moves played yet.',
  'game.promotion': 'Promotion',
  'keypad.showClassic': 'Classic / manual mode',
  'keypad.a11y': 'Chess move keypad',
  'keypad.clear': 'Clr',
  'keypad.show': 'Show chess move keypad',
  'keypad.hide': 'Hide chess move keypad',
  'keypad.systemOn': 'Return to chess move keypad',
  'keypad.systemOff': 'Use system keyboard',
  'a11y.back': 'Back',
  'a11y.voiceMute': 'Mute voice',
  'a11y.voiceUnmute': 'Unmute voice',
  'a11y.boardHide': 'Hide board',
  'a11y.boardShow': 'Show board',
  'a11y.coordsHide': 'Hide coordinates',
  'a11y.coordsShow': 'Show coordinates',
  'a11y.boardHidden': 'Board hidden',
  'a11y.validateMove': 'Submit move',
  'a11y.randomCamp': 'Random side',
  'a11y.moveRecognized': 'Move recognized',
  'a11y.listening': 'Listening…',
  'a11y.speak': 'Speak',
  'a11y.fullMoves': 'Full moves',
  'a11y.speed': 'Speed',
  'a11y.voiceSpeed': 'Voice speed',
  'a11y.pgnEnable': 'Enable this PGN',
  'a11y.pgnDisable': 'Disable this PGN',
  'a11y.questionCorrect': 'Correct answer',
  'a11y.questionIncorrect': 'Incorrect answer',
  'a11y.illustration': 'Illustration',
  'a11y.errorDetails': 'View error details',
  'a11y.closeErrorDetails': 'Close error details',
  'errors.generic': 'Something went wrong',
  'errors.tryAgain': 'Try Again',
  'errors.notFoundTitle': 'Oops!',
  'errors.notFoundBody': "This screen doesn't exist.",
  'errors.goHome': 'Go to home screen',
  'errors.noPgn': 'No PGN imported',
  'errors.noRecords': 'No records yet',
  'errors.repertoireLoad': 'Unable to load repertoire',
  'errors.invalidMove': 'Invalid move',
  'errors.noPuzzle': 'No puzzle available',
  'errors.micDenied': 'Microphone permission denied',
  'errors.voiceUnavailable': 'Voice recognition unavailable',
  'errors.folderNotFound': 'Folder not found.',
  'errors.folderEmptyName': 'Folder name cannot be empty.',
  'errors.folderExists': 'A folder named “{{name}}” already exists.',
  'errors.pgnEmpty': 'PGN content is empty.',
  'errors.pgnNotFound': 'PGN file not found.',
  'errors.filePgnNotFound': 'PGN file not found.',
  'openings.title': 'Openings',
  'openings.repertoires': 'PGN repertoires',
  'openings.new': 'New',
  'openings.deleteFolderTitle': 'Delete folder',
  'openings.deleteFolderBody':
    'Delete “{{name}}” and all PGN files it contains?',
  'openings.deleteFileTitle': 'Delete file',
  'openings.deleteFileBody': 'Delete “{{name}}”?',
  'openings.import': 'Import',
  'openings.replace': 'Replace',
  'openings.exercises': 'Exercises',
  'openings.playVsRepertoire': 'Play against the repertoire',
  'openings.continueLine': 'Continue the line',
  'openings.folderMissing': 'Folder not found',
  'openings.repertoire': 'Repertoire',
  'openings.theory': 'Theory',
  'openings.stockfish': 'Stockfish',
  'openings.viewTheoryLine': 'View theory line',
  'openings.theoryDeviation': 'You left theory with {{move}}.',
  'openings.theoryComplete': 'Theory line complete.',
  'openings.leftTheory': 'You left the theoretical line.',
  'openings.endOfTheoreticalLine': 'End of this theoretical line',
  'openings.restartLine': 'Restart this line',
  'openings.nextLine': 'Next line',
  'openings.continueVsStockfish': 'Continue vs Stockfish · {{level}}',
  'openings.undoThinkAgain': 'Undo my last move and think again',
  'openings.showExpectedMove': 'Show expected move',
  'openings.showFullLine': 'Show full line',
  'openings.expectedMove': 'Expected move: {{move}}',
  'openings.theoryCompleteContinuing': 'Theory complete · Continuing vs Stockfish',
  'openings.theoryLineTitle': 'Theory line',
  'openings.playedMoveHeading': 'Your move',
  'openings.availableTheoryMoves': 'Available theoretical moves',
  'openings.close': 'Close',
  'openings.theoryReport': 'Report: {{message}}',
  'openings.theoryReportComplete':
    'Report: imported theory line followed to the end.',
  'openings.returnToRepertoire': 'Back to repertoire',
  'openings.yourTurnContinue': 'Your turn to continue',
  'openings.lineComplete': 'Line complete',
  'openings.voiceSpeed': 'Voice speed',
  'openings.startLine': 'Starting line',
  'openings.positionReached': 'Position reached',
  'openings.importPgn': 'Import a PGN',
  'openings.importModalTitle': 'Import a PGN',
  'openings.replaceModalTitle': 'Replace PGN',
  'openings.pgnEvent': 'AnyChess — Openings',
  'openings.sidePickerTitle': 'Which side do you play?',
  'blind.title': 'Memorization',
  'blind.listenReconstruct': 'Listen then reconstruct',
  'blind.listenReconstructDesc':
    'Listen to a sequence, then rebuild it move by move.',
  'blind.watchRecite': 'Watch then recite',
  'blind.watchReciteDesc':
    'Watch a sequence, then recite it out loud.',
  'blind.fullMoves': 'Full moves',
  'blind.generate': 'Generate sequence',
  'blind.recitation': 'Recitation',
  'blind.reconstruction': 'Reconstruction',
  'blind.recognized': 'Recognized: {{san}}',
  'blind.skip': 'Skip',
  'blind.hint': 'Hint',
  'blind.recitePrompt': 'Say the next move out loud.',
  'blind.reconstructPrompt': 'Play the next move.',
  'blind.moveSkipped': 'Move skipped.',
  'blind.illegal': 'Illegal move.',
  'blind.correct': 'Correct.',
  'blind.moveError': 'Wrong move',
  'blind.expectedMove': 'Expected move: {{move}}',
  'blind.hintUsed': 'Hint used',
  'blind.recordListen': 'Listen/reconstruct record',
  'blind.recordWatch': 'Watch/recite record',
  'puzzle.title': 'Tactical training',
  'puzzle.nextMove': 'Next move: {{san}}',
  'puzzle.nextMoveLabel': 'Next move',
  'puzzle.sideWhite': 'White to move.',
  'puzzle.sideBlack': 'Black to move.',
  'puzzle.youPlayWhite': 'You play White',
  'puzzle.youPlayBlack': 'You play Black',
  'puzzle.plyAnnounce': '{{user}} played. Opponent plays {{opponent}}.',
  'puzzle.plyAnnounceNoReply': '{{user}} played.',
  'puzzle.solution': 'Solution',
  'puzzle.solved': 'Puzzle solved',
  'puzzle.solvedWithHelp': 'Puzzle solved with help',
  'puzzle.illegal': 'Illegal move.',
  'puzzle.incorrect': 'Incorrect move. Try again.',
  'puzzle.correct': 'Correct.',
  'puzzle.repeated': 'Repeated position.',
  'puzzle.unsolved': 'Puzzle unsolved',
  'puzzle.findMove': 'Find the move.',
  'puzzle.replaying': 'Replaying…',
  'puzzle.hubTitle': 'Tactical Training',
  'vision.title': 'Board vision',
  'vision.subtitle':
    'Three exercises to train mental tracking and quick move recognition.',
  'vision.mental': 'Mental position tracking',
  'vision.mentalDesc':
    'Follow a move sequence, then answer questions about the resulting position.',
  'vision.nommer': 'Name the move',
  'vision.nommerDesc': 'Identify the move played on the board as quickly as possible.',
  'vision.jouer': 'Play the move',
  'vision.jouerDesc': 'Play the given move as quickly as possible.',
  'vision.incorrectRetry': 'Incorrect — try again',
  'vision.correct': 'Correct',
  'vision.records': 'Records',
  'vision.fullMovesHint': '{{full}} full moves = {{half}} half-moves',
  'vision.perspective': 'PERSPECTIVE',
  'vision.dictate': 'Dictate the sequence',
  'vision.showBoard': 'Show the board during the sequence',
  'vision.sequence': 'Sequence',
  'vision.questionProgress': 'Question {{current}} / {{total}}',
  'vision.relisten': 'Replay the sequence',
  'vision.answerPlaceholder': 'Typed answer…',
  'vision.finishedScore': 'Done — score {{score}}/{{total}}',
  'vision.helpUsed': ' · help used',
  'vision.yourAnswer': 'Your answer: {{answer}}',
  'vision.newSequence': 'New sequence',
  'vision.nommerIntro':
    'Identify as many moves as you can in 60 seconds. No per-question time limit.',
  'vision.jouerIntro':
    'Play the requested move on the board as quickly as possible for 60 seconds.',
  'vision.lastMovePrompt': 'What was the last move?',
  'vision.unrecognizedRetry': 'Unrecognized move — try again',
  'vision.nommerPlaceholder': 'e.g. Knight takes e5',
  'vision.namedCorrect': 'Moves named correctly',
  'vision.playedCorrect': 'Moves played correctly',
  'vision.currentRecord': 'Current record: {{record}}',
  'vision.viewRecords': 'View records',
  'vision.scoreLabel': 'Score: {{score}}',
  'vision.scoreHeading': 'SCORE',
  'vision.newRecord': 'New record!',
  'vision.wrongCount': 'Incorrect: {{count}}',
  'vision.recordValue': 'Record: {{record}}',
  'quiz.title': 'General knowledge',
  'quiz.subtitle':
    'Uses the local ECO opening base — independent of your PGN repertoires.',
  'quiz.quiz': 'Quiz',
  'quiz.culture': 'Chess culture',
  'quiz.cultureDesc':
    'Test your chess culture with mixed questions on history, champions, rules, tournaments and the chess world.',
  'quiz.cultureMixed': 'Chess culture — 10 mixed questions',
  'quiz.quelle': 'Which opening?',
  'quiz.quelleDesc': 'Recognize the opening name from the played line (ECO base).',
  'quiz.construis': 'Build the opening',
  'quiz.construisDesc':
    'Dictate the line until the position that identifies the requested opening.',
  'quiz.incorrect': 'Incorrect.',
  'quiz.correct': 'Correct.',
  'quiz.played': 'Played: {{moves}}',
  'quiz.expected': 'Expected: {{san}}',
  'quiz.goodAnswer': 'Correct answer',
  'quiz.badAnswer': 'Wrong answer',
  'quiz.correctWas': 'Correct answer: {{answer}}',
  'quiz.wasQuestionCorrect': 'Was this question correct?',
  'quiz.nextQuestion': 'Next question',
  'quiz.seeResults': 'See results',
  'quiz.finished': 'Quiz finished',
  'quiz.noQuestions': 'No questions available right now.',
  'quiz.score': 'Score {{correct}} / {{total}}',
  'quiz.replay': 'Play again',
  'quiz.backToHub': 'Back to General knowledge',
  'quiz.identifyPrompt': 'Identify the opening after this line:',
  'quiz.openingPlaceholder': 'Opening name',
  'quiz.selectFamily': 'Which opening family?',
  'quiz.selectVariation': 'Which variation?',
  'quiz.selectOpening': 'Which opening?',
  'quiz.stepFamily': 'Step 1 — Family',
  'quiz.stepVariation': 'Step 2 — Variation',
  'quiz.correctExclaim': 'Correct!',
  'quiz.correctFamily': 'Correct (family accepted)!',
  'quiz.answerIs': 'Answer: {{name}}',
  'quiz.newOpening': 'New opening',
  'quiz.buildSubtitle': 'Play the exact reference line, move by move.',
  'quiz.opening': 'OPENING',
  'quiz.variation': 'VARIATION',
  'quiz.change': 'Change',
  'quiz.yourTurnRestart': 'Your turn to start again',
  'quiz.replaying': 'Replaying the opening…',
  'quiz.dictatePlaceholder': 'Dictate or type the move',
  'quiz.reviewOpening': 'Review the opening',
  'quiz.unrecognized': 'Unrecognized move.',
  'quiz.ambiguous': 'Ambiguous — rephrase the move (not counted as an error).',
  'quiz.constructed': 'Opening built!',
  'records.title': 'Records',
  'records.resetTitle': 'Reset records?',
  'records.resetBody':
    'This deletes your saved records and streaks. Your PGN repertoires, preferences and profile will be kept.',
  'records.empty': 'No records yet',
  'records.cat.tactics': 'Tactics',
  'records.cat.naming': 'Name the move',
  'records.cat.play': 'Play the move',
  'records.cat.blind': 'Memorization',
  'records.cat.culture': 'Culture',
  'records.cat.tacticsDesc': 'Best puzzle streaks by difficulty band',
  'records.cat.namingDesc': 'Best 60-second score (Board vision)',
  'records.cat.playDesc': 'Best 60-second score (Board vision)',
  'records.cat.blindDesc':
    'Best number of full moves at 100% with no help and no errors',
  'records.subtitle': 'Your best scores already saved on this device',
  'records.best60': 'Best score / 60 s',
  'records.resetTactics': 'Reset tactics records',
  'records.emptyTactics':
    'No records yet — solve puzzles to save some.',
  'records.blindResetBody':
    'This will reset the Listen then reconstruct and Watch then recite records.',
  'records.tacticsResetBody':
    'This will clear all saved best streaks.',
  'records.sessionResetTitle': 'Reset this record?',
  'records.sessionResetBody':
    'This will reset the best 60-second score for {{label}}.',
  'records.blindHint':
    'Best full-move count at 100%, with no hints or mistakes.',
  'records.puzzleSubtitle': 'Best streaks by difficulty band',
  'records.visionSubtitle': 'Best 60-second scores — Board vision',
  'records.visionResetTitle': 'Reset all records?',
  'records.visionResetBody':
    'This will reset the 60-second records. Older delay-based (legacy) scores stay stored separately.',
  'records.legacyNote':
    'Older delay-based records are still present in storage (legacy).',
  'openings.emptyTitle': 'You don’t have a repertoire yet',
  'openings.emptyBody':
    'Import a PGN file with an opening you want to practice.',
  'openings.emptyLead':
    'Import a PGN file with an opening you want to practice.',
  'openings.emptySources':
    'You can get these files from your chess software, a game database, a repertoire you built yourself, or a training service that exports to PGN.',
  'openings.emptyPurpose':
    'AnyChess will use the variations in your file so you can replay and memorize them.',
  'openings.sectionWhite': 'WHITE REPERTOIRE',
  'openings.sectionBlack': 'BLACK REPERTOIRE',
  'openings.sectionUnassigned': 'NO SIDE',
  'openings.sectionUnassignedHint':
    'Open each folder and choose “I play White” or “I play Black” on import.',
  'openings.newRepertoire': 'New repertoire',
  'openings.renameRepertoire': 'Rename repertoire',
  'openings.create': 'Create',
  'openings.namePlaceholder': 'e.g. Accelerated Dragon',
  'openings.renamePlaceholder': 'New name',
  'openings.delete': 'Delete',
  'openings.remove': 'Remove',
  'openings.removeFileTitle': 'Remove file',
  'openings.removeFileBody':
    'Remove “{{name}}” from this repertoire? The folder itself will be kept.',
  'openings.folderHint':
    'Multiple PGNs in this folder are merged into one repertoire tree (transpositions recognized, duplicates avoided).',
  'openings.playVsDesc':
    'The opponent follows your imported lines, then Stockfish out of book.',
  'openings.continueLineDesc':
    'Recite the continuation of a branch chosen from this repertoire.',
  'openings.managePgn': 'Manage PGNs',
  'openings.emptyPgnBody':
    'Import one or more .pgn files (paste or file picker).',
  'openings.filesCount': '{{count}} PGN file(s)',
  'openings.importSideRequired':
    'Choose which side you train this repertoire from.',
  'openings.fileReadError': 'Unable to read the file.',
  'openings.preparing': 'Preparing…',
  'openings.preparingGame': 'Preparing the game…',
  'openings.loadingRepertoire': 'Loading repertoire…',
  'openings.repertoireThinking': 'Repertoire…',
  'openings.followsRepertoire': 'The opponent follows your repertoire',
  'openings.exportBody':
    'Includes moves, result, your color, and the repertoire.',
  'openings.exportBodyWithTheory':
    'Includes moves, result, your color, the repertoire, and the theory-exit comment.',
  'openings.status': 'Status',
  'openings.correctMoves': 'Correct moves: {{count}}',
  'openings.failed': 'Error — exercise stopped',
  'openings.fromStart': 'Continue the line from the start{{side}}.',
  'openings.replaySameLine': 'Replay the same line',
  'openings.newLine': 'New line',
  'openings.voiceSpeedRange': 'Voice speed (1–10)',
  'openings.slow': 'Slow',
  'openings.fast': 'Fast',
  'openings.filename': 'File name',
  'openings.pgnContent': 'PGN content',
  'openings.pickFile': 'Choose a file…',
  'openings.importedSummary':
    'Imported: {{games}} game(s), {{positions}} position(s)',
  'openings.noValidPositions': 'No valid positions imported',
  'openings.analyzing': 'Analyzing…',
  'openings.disabled': '(disabled)',
  'openings.importedOn': 'Imported on {{date}}',
  'openings.gamesCount': '{{count}} game(s)',
  'openings.positionsCount': '{{count}} position(s)',
  'openings.errorsCount': '{{count}} error(s)',
  'openings.importPartial': 'Partial import',
  'openings.importSuccess': 'Import successful',
  'openings.importFailed': 'Import failed',
  'openings.gamesChapters': 'Games / chapters: {{count}}',
  'openings.positionsParsed': 'Positions parsed: {{count}}',
  'openings.branches': 'Branches: {{count}}',
  'openings.importPartialDetail':
    'Partial import — some lines rejected',
  'openings.errorsLabel': 'Errors ({{count}})',
  'openings.warningsLabel': 'Warnings ({{count}})',
  'openings.movePlaceholder': 'e.g. e4, Nf3, O-O…',
  'openings.folderIdMissing': 'Folder missing.',
  'openings.repertoireNotFound': 'Repertoire not found.',
  'openings.noSideAssigned':
    '“{{name}}” has no side saved. Open the repertoire and set White or Black.',
  'openings.noPlayablePositions':
    '“{{name}}” contains no playable positions.',
  'openings.noWhiteToReview': 'No White repertoires to review.',
  'openings.noBlackToReview': 'No Black repertoires to review.',
  'openings.noToReview': 'No repertoires to review.',
  'openings.mixedPickFailed':
    'Unable to pick a line from the mixed selection.',
  'openings.startFailed': 'Unable to start.',
  'openings.ambiguousRetry':
    'Ambiguous — rephrase the move (not counted as an error).',
  'openings.unrecognizedRetry':
    'Not recognized — try again (not counted as an error).',
  'openings.notPlayable': 'Illegal here — try again.',
  'openings.okMove': 'OK: {{san}}',
  'openings.opening': 'Opening',
  'openings.playEmpty':
    'This repertoire has no playable positions. Import a PGN first.',
  'openings.yourMove': 'Your move: {{move}}',
  'openings.expectedOnLine': 'Expected move on this line:',
  'openings.proposedContinuation': 'Suggested continuation:',
  'openings.none': '(none)',
  'openings.endOfLine': '(end of line)',
  'openings.incorrectSpeak': 'Incorrect. Your move: {{move}}. Suggested continuation: {{suite}}',
  'openings.continueSpeak': 'Continue the line{{side}}.',
  'openings.continueFromStartSpeak': 'Continue the line from the start{{side}}.',
  'blind.hubLead':
    'Choose an exercise. Sequences are generated by Stockfish (1 to 20 full moves).',
  'blind.record': 'Record: {{count}} full moves',
  'blind.recordZero': 'Record: 0',
  'blind.perspective': 'PERSPECTIVE',
  'blind.perspectiveHint':
    'White always moves first. 1 full move = 1 White move + 1 Black move.',
  'blind.fullMovesEq':
    '{{full}} full moves = {{half}} half-moves{{max}}',
  'blind.maximum': ' (maximum)',
  'blind.speedLabel': 'Speed ({{min}}–{{max}})',
  'blind.slow': 'Slow',
  'blind.fast': 'Fast',
  'blind.speedSlowHint': 'Slow — more time between moves',
  'blind.speedFastHint': 'Fast — tight pacing',
  'blind.speedDefaultHint': 'Speed {{speed}} (default {{default}})',
  'blind.oralDictation': ' · spoken dictation',
  'blind.visualObservation': ' · visual observation',
  'blind.moveProgress': 'Move {{current}} / {{total}}',
  'blind.dictation': 'Dictation',
  'blind.dictationListen':
    'Listen to the {{total}} half-moves. No notation shown.',
  'blind.dictationInProgress': 'Dictation in progress',
  'blind.dictationDone': 'Dictation finished',
  'blind.yourTurn': 'Your turn',
  'blind.replaySequence': 'Replay the sequence',
  'blind.startReconstruction': 'Start reconstruction',
  'blind.observation': 'Observation',
  'blind.observationHint': 'Watch the sequence — no spoken announcements.',
  'blind.observationProgress':
    'Observation · Move {{current}} / {{total}}',
  'blind.sequenceDone': 'Sequence finished',
  'blind.yourTurnRecite': 'Your turn to recite',
  'blind.goToRecitation': 'Go to recitation',
  'blind.result': 'Result',
  'blind.withoutHelp': 'No help',
  'blind.withError': 'With mistakes',
  'blind.succeeded': '{{done}} / {{total}} succeeded',
  'blind.newRecord': 'New record: {{count}} full moves',
  'blind.recordLine': 'Record: {{count}} full moves',
  'blind.recordIneligible': 'Record not eligible for this attempt',
  'blind.replaying': 'Replay {{current}} / {{total}}',
  'blind.finalPosition': 'Final position',
  'blind.detail': 'Details',
  'blind.correctFirstTry': 'Correct on first try',
  'blind.wrongPiece': 'Wrong piece',
  'blind.wrongDestination': 'Wrong destination',
  'blind.wrongOrder': 'Wrong order',
  'blind.helpsUsed': 'Hints used',
  'blind.wrongMove': 'Wrong moves',
  'blind.recognitionFailures': 'Recognition failures (not counted)',
  'blind.retrySame': 'Retry the same sequence',
  'blind.reviewSequence': 'Review the sequence',
  'blind.newSequence': 'New sequence',
  'blind.exercisesMenu': 'Exercise menu',
  'blind.movePlaceholder': 'e.g. e4, Nf3, O-O…',
  'puzzle.hubLead':
    'Put your tactical vision to the test, with or without the board, through thousands of varied problems suited to every level.',
  'puzzle.mode': 'Mode',
  'puzzle.visual': 'Visual',
  'puzzle.blind': 'Blindfold',
  'puzzle.difficulty': 'Difficulty',
  'puzzle.visualCardTitle': 'Visual Problems',
  'puzzle.visualCardDesc': 'Solve chess problems directly on the board.',
  'puzzle.blindCardTitle': 'Blindfold Problems',
  'puzzle.blindCardDesc': 'Solve chess problems without seeing the full position.',
  'puzzle.difficultyDefaultHint':
    'You can change the default difficulty in Settings.',
  'settings.problemDifficulty': 'PROBLEM DIFFICULTY',
  'settings.visualProblemDifficulty': 'Visual problem difficulty',
  'settings.blindProblemDifficulty': 'Blind problem difficulty',
  'puzzle.randomAll': 'Random / All',
  'puzzle.pieceCount': 'Number of pieces',
  'puzzle.startBlind': 'Start blindfold',
  'puzzle.startVisual': 'Start visual',
  'puzzle.chooseMode': 'Choose a mode',
  'puzzle.noMatch':
    'No puzzle matches these filters. Widen the rating range and try again.',
  'puzzle.noMatchBlind':
    'No puzzle matches these filters. Widen the rating or piece count and try again.',
  'puzzle.meta':
    '{{id}} · rating {{rating}} (Lichess) · {{side}} · Streak: {{streak}}',
  'puzzle.streak': 'Streak: {{count}}',
  'puzzle.whitePieces': 'White pieces',
  'puzzle.blackPieces': 'Black pieces',
  'puzzle.repeat': 'Repeat',
  'puzzle.soundOff': 'Sound off — visual replay only.',
  'puzzle.result': 'Result',
  'puzzle.solutionConsulted': 'Solution consulted',
  'puzzle.wrongMoves': 'Wrong moves',
  'puzzle.recognitionErrors': 'Recognition errors',
  'puzzle.hintsUsed': 'Hints used',
  'puzzle.nextPuzzle': 'Next puzzle',
  'puzzle.retryPuzzle': 'Retry this puzzle',
  'puzzle.replaySolution': 'Replay the solution',
  'puzzle.menu': 'Puzzle menu',
  'puzzle.movePlaceholder': 'e.g. Nf3, Bxe5, O-O…',
  'puzzle.all': 'All',
};

const DICTS: Record<AppLanguage, Dict> = { fr, en };

export type MessageParams = Record<string, string | number>;

function applyParams(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key];
    return value == null ? '' : String(value);
  });
}

export function translate(
  language: AppLanguage,
  key: MessageKey,
  params?: MessageParams,
): string {
  const template = DICTS[language][key] ?? DICTS.fr[key] ?? key;
  return applyParams(template, params);
}

export function speechLocaleForLanguage(language: AppLanguage): string {
  return language === 'en' ? 'en-US' : 'fr-FR';
}
