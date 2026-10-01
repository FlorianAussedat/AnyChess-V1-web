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
  | 'common.yes'
  | 'common.no'
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
  | 'game.abandonShort'
  | 'game.quitExerciseShort'
  | 'game.quitTrainingShort'
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
  | 'openings.learn'
  | 'openings.learnHint'
  | 'openings.managePgn'
  | 'openings.manageTitle'
  | 'openings.hubLead'
  | 'openings.hubReviewHint'
  | 'openings.hubLearnHint'
  | 'openings.reviewPoolSummary'
  | 'openings.activePgnList'
  | 'openings.noActivePgn'
  | 'openings.folderActive'
  | 'openings.folderInactive'
  | 'openings.viewPgn'
  | 'openings.changeSideConfirmTitle'
  | 'openings.changeSideConfirmBody'
  | 'openings.noComment'
  | 'openings.tabComments'
  | 'openings.tabNotation'
  | 'openings.annotatePgn'
  | 'openings.annotateThisPgn'
  | 'openings.createPgn'
  | 'openings.importOpeningPgn'
  | 'openings.importTitle'
  | 'openings.importedToUnfiled'
  | 'openings.systemFolder'
  | 'openings.unfiledHint'
  | 'openings.createOpeningPgn'
  | 'openings.editOpeningPgn'
  | 'openings.createFolderFab'
  | 'openings.createFolderA11y'
  | 'openings.saveToAnyChess'
  | 'openings.exportPgn'
  | 'openings.addComment'
  | 'openings.editComment'
  | 'openings.deleteComment'
  | 'openings.deleteVariation'
  | 'openings.goParentLine'
  | 'openings.addAnnotation'
  | 'openings.createVariationHint'
  | 'openings.confirmVariationTitle'
  | 'openings.confirmVariationBody'
  | 'openings.unsavedTitle'
  | 'openings.unsavedBody'
  | 'openings.leaveWithoutSaving'
  | 'openings.commentPlaceholder'
  | 'openings.commentNeedMove'
  | 'openings.newPgnName'
  | 'openings.newPgnNamePlaceholder'
  | 'openings.newStudyDefault'
  | 'openings.undoEdit'
  | 'openings.redoEdit'
  | 'openings.analyzeThisPosition'
  | 'openings.returnToEditor'
  | 'openings.addAnalyzedLine'
  | 'openings.createStudyFromHere'
  | 'openings.createStudyScopeTitle'
  | 'openings.createStudyScopeBody'
  | 'openings.createStudyFromStart'
  | 'openings.createStudyFromPosition'
  | 'openings.createStudyNameTitle'
  | 'openings.branchPickerTitle'
  | 'openings.mainLine'
  | 'openings.variation'
  | 'openings.returnToCourse'
  | 'openings.playThisLine'
  | 'openings.continueThisLine'
  | 'openings.analyzeGame'
  | 'openings.studyThisOpening'
  | 'openings.currentMove'
  | 'openings.sideRequired'
  | 'openings.learnFolders'
  | 'openings.learnPgns'
  | 'openings.linesShort'
  | 'openings.pgnMasteryMeta'
  | 'openings.filterUnmastered'
  | 'openings.filterPartial'
  | 'openings.filterMastered'
  | 'openings.filterPriority'
  | 'openings.filterAll'
  | 'openings.lineMastered'
  | 'openings.lineToWork'
  | 'openings.emptyFilterUnmastered'
  | 'openings.emptyFilterPartial'
  | 'openings.emptyFilterMastered'
  | 'openings.emptyFilterPriority'
  | 'openings.emptyFilterAll'
  | 'openings.priorityA11yOn'
  | 'openings.priorityA11yOff'
  | 'openings.trainUnmastered'
  | 'openings.noUnmasteredLines'
  | 'openings.continueVsEngineShort'
  | 'openings.toggleReview'
  | 'openings.setSide'
  | 'openings.unassignedSideHint'
  | 'openings.toClassify'
  | 'openings.chooseWhiteOrBlack'
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
  | 'cloud.section'
  | 'cloud.email'
  | 'cloud.password'
  | 'cloud.signIn'
  | 'cloud.signUp'
  | 'cloud.signOut'
  | 'cloud.recover'
  | 'cloud.recoverSent'
  | 'cloud.statusSynced'
  | 'cloud.statusPending'
  | 'cloud.statusError'
  | 'cloud.statusOffline'
  | 'cloud.statusSignedOut'
  | 'cloud.statusUnconfigured'
  | 'cloud.syncNow'
  | 'cloud.unconfiguredHint'
  | 'cloud.signedInAs'
  | 'cloud.errorInvalid'
  | 'cloud.errorTaken'
  | 'cloud.errorWeak'
  | 'cloud.errorConfirmEmail'
  | 'cloud.errorOffline'
  | 'cloud.errorRejected'
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
  | 'parties.importPgnFen'
  | 'parties.startFromInitial'
  | 'parties.createFolderFab'
  | 'parties.createFolderA11y'
  | 'parties.unfiledFolder'
  | 'parties.systemFolder'
  | 'parties.importFilePgn'
  | 'parties.pastePgn'
  | 'parties.pastePgnPlaceholder'
  | 'parties.pasteFen'
  | 'parties.pasteFenPlaceholder'
  | 'parties.pgnInvalid'
  | 'parties.fenInvalid'
  | 'parties.saveAnalysis'
  | 'parties.savedToUnfiled'
  | 'parties.alreadySaved'
  | 'parties.importTitle'
  | 'parties.emptyFolder'
  | 'parties.moveGame'
  | 'parties.folderLocked'
  | 'parties.anyliseurProfileFastDesc'
  | 'parties.anyliseurProfileNormalDesc'
  | 'parties.anyliseurProfileDeepDesc'
  | 'parties.anyliseurProfileMetric'
  | 'parties.empty'
  | 'parties.noMeta'
  | 'parties.moveCount'
  | 'parties.importOk'
  | 'parties.importProgress'
  | 'parties.importRenameOffer'
  | 'parties.multiSelectTitle'
  | 'parties.multiSelectCount'
  | 'parties.gameSelectTitle'
  | 'parties.gameSelectFound'
  | 'parties.gameSelectSearch'
  | 'parties.gameSelectMax'
  | 'parties.gameSelectEmpty'
  | 'parties.gameSelectIndexed'
  | 'parties.importSelectedCount'
  | 'parties.newFolder'
  | 'parties.folderDeleteTitle'
  | 'parties.folderDeleteConfirm'
  | 'parties.folderDeleteAll'
  | 'parties.importDuplicates'
  | 'parties.importSkipped'
  | 'parties.importNone'
  | 'parties.importFailed'
  | 'parties.deleteTitle'
  | 'parties.deleteConfirmMessage'
  | 'parties.deleteConfirm'
  | 'parties.voiceCommands'
  | 'parties.nameRequired'
  | 'parties.importCancelled'
  | 'parties.importAction'
  | 'parties.gameNamePlaceholder'
  | 'parties.gameName'
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
  | 'parties.openAnalyzer'
  | 'parties.openWorkspace'
  | 'parties.workspace'
  | 'parties.workspaceSubtitle'
  | 'parties.parseError'
  | 'parties.parseErrorHint'
  | 'parties.analyzerLoad'
  | 'parties.analyzerPaste'
  | 'parties.analyzerEmpty'
  | 'parties.analyzerSubtitle'
  | 'parties.analyzer'
  | 'parties.flipBoard'
  | 'parties.anyliseurTabGame'
  | 'parties.anyliseurTabAnalysis'
  | 'parties.anyliseurProfileFast'
  | 'parties.anyliseurProfileNormal'
  | 'parties.anyliseurProfileDeep'
  | 'parties.anyliseurExport'
  | 'parties.anyliseurExportDone'
  | 'parties.anyliseurExportFail'
  | 'parties.anyliseurOpenReader'
  | 'parties.anyliseurArrowsOn'
  | 'parties.anyliseurArrowsOff'
  | 'parties.anyliseurUnavailable'
  | 'parties.anyliseurRetry'
  | 'parties.anyliseurInitializing'
  | 'parties.anyliseurAnalyzing'
  | 'parties.anyliseurReady'
  | 'parties.anyliseurProgress'
  | 'parties.anyliseurProgressMain'
  | 'parties.anyliseurProgressVariants'
  | 'parties.anyliseurPlayed'
  | 'parties.anyliseurBest'
  | 'parties.anyliseurBefore'
  | 'parties.anyliseurAfter'
  | 'parties.anyliseurBestMoves'
  | 'parties.anyliseurWaiting'
  | 'parties.anyliseurMore'
  | 'parties.anyliseurLess'
  | 'parties.anyliseurCurve'
  | 'parties.anyliseurAnalyzed'
  | 'parties.anyliseurReanalyze'
  | 'parties.anyliseurExportIncludeEvals'
  | 'parties.anyliseurExportCopyPgn'
  | 'parties.anyliseurExportDownloadPgn'
  | 'parties.anyliseurExportCopyFen'
  | 'parties.anyliseurExportDownloadFen'
  | 'parties.anyliseurImportFile'
  | 'parties.anyliseurImportPaste'
  | 'parties.anyliseurImportLibrary'
  | 'parties.anyliseurImportInvalid'
  | 'parties.anyliseurMultiGameChoice'
  | 'parties.anyliseurFenLoaded'
  | 'parties.anyliseurA11yFlip'
  | 'parties.anyliseurA11yFlipHint'
  | 'parties.anyliseurA11yArrowsHint'
  | 'parties.anyliseurA11yProfile'
  | 'parties.anyliseurA11yProfileHint'
  | 'parties.anyliseurA11yImport'
  | 'parties.anyliseurA11yImportHint'
  | 'parties.anyliseurA11yExportHint'
  | 'parties.anyliseurA11yOpenReaderHint'
  | 'parties.anyliseurA11yReturn'
  | 'parties.anyliseurA11yReturnHint'
  | 'parties.anyliseurProfileTitle'
  | 'parties.anyliseurProfileHint'
  | 'parties.anyliseurProfileClose'
  // Game shared
  | 'game.movesPlayed'
  | 'game.exportPgn'
  | 'game.export'
  | 'game.yourTurn'
  | 'game.opponentThinking'
  | 'game.opponentPreparing'
  | 'game.opponentFailed'
  | 'game.opponentRetry'
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
  | 'errors.systemFolderProtected'
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
  | 'openings.moveOr'
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
  | 'quiz.defendsNulle'
  | 'quiz.defendsNullePageTitle'
  | 'quiz.defendsNulleDesc'
  | 'quiz.defendsNulleLead'
  | 'quiz.defendsNulleProgress'
  | 'quiz.defendsNulleThinking'
  | 'quiz.defendsNullePreparing'
  | 'quiz.defendsNulleReflecting'
  | 'quiz.defendsNulleLoading'
  | 'quiz.defendsNulleAgain'
  | 'quiz.defendsNulleNext'
  | 'quiz.defendsNulleContinue'
  | 'quiz.defendsNulleRestart'
  | 'quiz.defendsNulleAnother'
  | 'quiz.defendsNulleEngineUnavailable'
  | 'quiz.stockfishPreparing'
  | 'quiz.stockfishWebError'
  | 'quiz.stockfishNativeUnavailable'
  | 'quiz.stockfishRetry'
  | 'quiz.stockfishBack'
  | 'quiz.positionNotFound'
  | 'quiz.stockfishDevDetail'
  | 'quiz.endgameNewFinales'
  | 'quiz.endgameNewFinalesDesc'
  | 'quiz.endgameTryAgain'
  | 'quiz.endgameTryAgainDesc'
  | 'quiz.endgameTryAgainEmpty'
  | 'quiz.endgamePoolExhausted'
  | 'quiz.endgamePoolPreparing'
  | 'quiz.endgameMovesResisted'
  | 'quiz.endgameHideGauge'
  | 'quiz.endgameShowGauge'
  | 'quiz.endgameOffScore'
  | 'quiz.endgameVerifying'
  | 'quiz.endgameThisAttempt'
  | 'quiz.endgamePrevAttempt'
  | 'quiz.endgameBestAttempt'
  | 'quiz.endgameAnalyse'
  | 'quiz.analyseGame'
  | 'quiz.analysePosition'
  | 'quiz.endgameAddTryAgain'
  | 'quiz.endgameAddedTryAgain'
  | 'quiz.endgameRetry'
  | 'quiz.endgameContinuePosition'
  | 'quiz.endgameContinueOffScore'
  | 'quiz.endgameRemoveTryAgain'
  | 'quiz.endgameBackMenu'
  | 'quiz.endgameObjectiveWin'
  | 'quiz.endgameObjectiveDraw'
  | 'quiz.endgameOfferDraw'
  | 'quiz.endgameCopyFen'
  | 'quiz.endgameFenCopied'
  | 'quiz.endgameReplay'
  | 'quiz.theoreticalEndgameTitle'
  | 'quiz.theoreticalEndgameDesc'
  | 'quiz.theoreticalEndgameLead'
  | 'quiz.theoreticalRandom'
  | 'quiz.theoreticalViewList'
  | 'quiz.theoreticalViewCards'
  | 'quiz.theoreticalAllMastered'
  | 'quiz.theoreticalNoAttempts'
  | 'quiz.theoreticalCompleted'
  | 'quiz.theoreticalObjectiveWin'
  | 'quiz.theoreticalObjectiveDraw'
  | 'quiz.theoreticalMovesPlayed'
  | 'quiz.theoreticalOffScore'
  | 'quiz.theoreticalVerifying'
  | 'quiz.theoreticalAnalyse'
  | 'quiz.theoreticalRetry'
  | 'quiz.theoreticalNext'
  | 'quiz.theoreticalContinueOffScore'
  | 'quiz.theoreticalBackThemes'
  | 'quiz.theoreticalExitTitle'
  | 'quiz.theoreticalExitBody'
  | 'quiz.theoreticalExitContinue'
  | 'quiz.theoreticalExitConfirm'
  | 'quiz.theoreticalScoreOld'
  | 'quiz.theoreticalScoreNew'
  | 'quiz.theoreticalScoreAttempts'
  | 'quiz.theoreticalThemeQueenMate'
  | 'quiz.theoreticalThemeRookMate'
  | 'quiz.theoreticalThemeTwoBishopsMate'
  | 'quiz.theoreticalThemePawnSquare'
  | 'quiz.theoreticalThemeOpposition'
  | 'quiz.theoreticalThemeKpVsK'
  | 'quiz.theoreticalThemePawnRace'
  | 'quiz.theoreticalThemePawnBreakthrough'
  | 'quiz.theoreticalThemeThreePawns'
  | 'quiz.theoreticalThemeLucena'
  | 'quiz.theoreticalThemePhilidor'
  | 'quiz.theoreticalExplainLink'
  | 'quiz.theoreticalExplainPrinciple'
  | 'quiz.theoreticalExplainSeek'
  | 'quiz.theoreticalExplainMethod'
  | 'quiz.theoreticalExplainAvoid'
  | 'quiz.theoreticalExplainPlay'
  | 'quiz.theoreticalExplainClose'
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
  | 'quiz.pickLevel'
  | 'quiz.notEnoughLines'
  | 'quiz.reviewQuestions'
  | 'quiz.changeLevel'
  | 'quiz.seeRecords'
  | 'quiz.replaySameLevel'
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
  | 'records.cat.openingQuiz'
  | 'records.cat.tacticsDesc'
  | 'records.cat.namingDesc'
  | 'records.cat.playDesc'
  | 'records.cat.blindDesc'
  | 'records.cat.openingQuizDesc'
  | 'records.subtitle'
  | 'records.best60'
  | 'records.bestOutOfTen'
  | 'records.resetTactics'
  | 'records.emptyTactics'
  | 'records.emptyOpeningQuiz'
  | 'records.blindResetBody'
  | 'records.tacticsResetBody'
  | 'records.openingQuizResetBody'
  | 'records.sessionResetTitle'
  | 'records.sessionResetBody'
  | 'records.blindHint'
  | 'records.openingQuizHint'
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
  | 'openings.createFolder'
  | 'openings.pickFolderTitle'
  | 'openings.pickFolderHint'
  | 'openings.pickFolderEmpty'
  | 'openings.renameDisplayName'
  | 'openings.renameDisplayPlaceholder'
  | 'openings.moveToFolder'
  | 'openings.addToOpeningsFolder'
  | 'openings.addToOpeningsDone'
  | 'openings.addToOpeningsFail'
  | 'openings.noPgnInGame'
  | 'openings.importNeedsFolder'
  | 'openings.linesCount'
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
  | 'settings.engineStrength'
  | 'settings.stockfishStrength'
  | 'settings.stockfishStrengthHint'
  | 'settings.translation'
  | 'settings.translateExistingPgn'
  | 'settings.translateImportedPgn'
  | 'settings.translationNone'
  | 'settings.translationProgress'
  | 'settings.translationProgressHint'
  | 'settings.translationPaused'
  | 'settings.translationComplete'
  | 'settings.translationRetry'
  | 'settings.translationDiagTitle'
  | 'settings.translationDiagCopy'
  | 'settings.translationDiagCopied'
  | 'settings.translationTimeout'
  | 'settings.translationRateLimited'
  | 'settings.translationCounts'
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
  | 'activity.resumeTitle'
  | 'activity.resumeCta'
  | 'activity.discardPartieTitle'
  | 'activity.discardPartieBody'
  | 'activity.discardPartieConfirm'
  | 'activity.discardProblemeTitle'
  | 'activity.discardProblemeBody'
  | 'activity.discardProblemeConfirm'
  | 'activity.discardQuizTitle'
  | 'activity.discardQuizBody'
  | 'activity.discardQuizConfirm'
  | 'activity.discardCoursTitle'
  | 'activity.discardCoursBody'
  | 'activity.discardCoursConfirm'
  | 'activity.discardExerciceTitle'
  | 'activity.discardExerciceBody'
  | 'activity.discardExerciceConfirm'
  | 'activity.quitCta'
  | 'activity.endPartieTitle'
  | 'activity.endPartieBody'
  | 'activity.endExerciceTitle'
  | 'activity.endExerciceBody'
  | 'activity.endAnalyseTitle'
  | 'activity.endAnalyseBody'
  | 'activity.endQuizTitle'
  | 'activity.endQuizBody'
  | 'activity.endTrainingTitle'
  | 'activity.endTrainingBody'
  | 'activity.continueGame'
  | 'activity.continueExercise'
  | 'activity.continueTraining'
  | 'activity.abandonTitle'
  | 'activity.abandonBody'
  | 'activity.abandonConfirm'
  | 'activity.backPartieTitle'
  | 'activity.backExerciceTitle'
  | 'activity.backExerciceConfirm'
  | 'home.tagline'
  | 'board.gameContinues'
  | 'board.show'
  | 'campPicker.title'
  | 'campPicker.randomSide'
  | 'campPicker.hint'
  | 'exercise.referenceCopied'
  | 'exercise.tryAgainAlready'
  | 'exercise.tryAgainAddTitle'
  | 'review.bestMove'
  | 'review.returnToPosition'
  | 'review.finishGameTitle'
  | 'review.finishGameBody'
  | 'review.backToResult'
  | 'review.finishGame'
  | 'puzzle.bandRandomAll'
  | 'profil.eloUnrated'
  | 'openings.noPlayableLine'
  | 'vision.answerRecorded'
  | 'vision.insufficientQuestions'
  | 'endgame.drawStalemate'
  | 'endgame.drawThreefold'
  | 'endgame.drawInsufficient'
  | 'endgame.drawFifty'
  | 'endgame.drawDefended'
  | 'endgame.drawGeneric'
  | 'endgame.defendedThirty'
  | 'endgame.checkmateWin'
  | 'endgame.checkmateLoss'
  | 'endgame.positionWon'
  | 'endgame.drawAchieved'
  | 'endgame.illegalMove'
  | 'endgame.heldMoves'
  | 'endgame.evalChanged'
  | 'endgame.noReliableAlternative'
  | 'endgame.drawAltOne'
  | 'endgame.drawAltTwo'
  | 'endgame.drawAltThree'
  | 'endgame.drawAltThreeMore'
  | 'endgame.noMajorMistake'
  | 'endgame.firstTurn'
  | 'endgame.stockfishUnavailable'
  | 'endgame.engineError'
  | 'endgame.moveNotRecognized'
  | 'endgame.drawDefendedShort'
  | 'endgame.mateDefended'
  | 'theoretical.lostOnMove'
  | 'theoretical.gameOver'
  | 'theoretical.drawObtained'
  | 'errors.illegalSan'
  | 'errors.invalidStartFen'
  | 'errors.malformedPgn'
  | 'errors.noGamesFound'
  | 'openings.leftRepertoire'
  | 'openings.endOfTheory'
  | 'position.refPrefix'
  | 'quiz.defendsNulleDefendNext'
  | 'pgn.commentOriginal'
  | 'pgn.commentFrench'
  | 'pgn.translateComments'
  | 'pgn.completeTranslation'
  | 'pgn.retryTranslation'
  | 'pgn.translateSelection'
  | 'pgn.translateAllExisting'
  | 'pgn.translating'
  | 'pgn.translationPending'
  | 'pgn.translationPartial'
  | 'pgn.translationUnavailable'
  | 'pgn.translationQueued'
  | 'pgn.serviceNotConfigured'
  | 'pgn.translationQuota'
  | 'pgn.translationQuotaResume'
  | 'pgn.translationUsage'
  | 'pgn.translationFailed'
  | 'pgn.importNotice'
  | 'pgn.batchProgress'
  | 'pgn.exportOriginal'
  | 'pgn.exportFrench'
  | 'pgn.exportBilingual'
  | 'pgn.languageUnknown'
  | 'pgn.cancelBatch'
  | 'pgn.resumeBatch'
  | 'pgn.offlineQueued'
  | 'pgn.catchupHint'
  | 'pgn.alreadyFrench'
  | 'speech.micDenied'
  | 'speech.micUnavailable'
  | 'speech.unavailableBrowser'
  | 'speech.micDeniedBrowser'
  | 'speech.micUnavailableDevice'
  | 'speech.micPermissionFailed'
  | 'speech.startFailed'
  | 'speech.unsupported'
  | 'speech.micError'
  | 'speech.nothingRecognized'
  | 'vision.answerUnrecognized'
  | 'errors.folderParentMissing'
  | 'errors.systemFolderDelete'
  | 'game.exportOrAnalyze'
  | 'game.exportNo'
  | 'game.exportYes'
  | 'blind.reciteSequence'
  | 'puzzle.illegalHere'
  | 'activity.openingTraining'

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
  'common.continue': 'Continuer',
  'common.confirm': 'Confirmer',
  'common.validate': 'Valider',
  'common.reset': 'Réinitialiser',
  'common.erase': 'Effacer',
  'common.save': 'Enregistrer',
  'common.yes': 'Oui',
  'common.no': 'Non',
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
  'game.abandonShort': 'Abandonner',
  'game.quitExerciseShort': 'Quitter l’exercice',
  'game.quitTrainingShort': 'Quitter l’entraînement',
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
  'openings.learn': 'Apprentissage',
  'openings.learnHint':
    'Étudie chaque ouverture séparément, avec commentaires et variantes.',
  'openings.managePgn': 'Importer / gérer mes PGN',
  'openings.manageTitle': 'Mes PGN d’ouverture',
  'openings.hubLead':
    'Découvre tes ouvertures, puis entraîne-toi à retrouver les bons coups.',
  'openings.hubReviewHint': 'Retrouve les bons coups de tes ouvertures.',
  'openings.hubLearnHint':
    'Parcours tes ouvertures à ton rythme, coup par coup.',
  'openings.reviewPoolSummary': '{{pgn}} PGN actifs · {{lines}} lignes disponibles',
  'openings.activePgnList': 'PGN qui participent à la Révision',
  'openings.noActivePgn':
    'Aucun PGN actif. Active un dossier et au moins un PGN dans la gestion.',
  'openings.folderActive': 'Actif pour la Révision',
  'openings.folderInactive': 'Inactif pour la Révision',
  'openings.viewPgn': 'Voir / Étudier',
  'openings.changeSideConfirmTitle': 'Changer de camp ?',
  'openings.changeSideConfirmBody':
    'Ce PGN passera d’un dossier {{from}} à un dossier {{to}}. L’orientation d’entraînement suivra le nouveau dossier.',
  'openings.noComment': 'Aucun commentaire pour ce coup.',
  'openings.tabComments': 'Commentaires',
  'openings.tabNotation': 'Notation',
  'openings.annotatePgn': 'Annoter / éditer',
  'openings.annotateThisPgn': 'Annoter ce PGN',
  'openings.createPgn': 'Créer un PGN',
  'openings.importOpeningPgn': 'Importer un PGN d’ouverture',
  'openings.importTitle': 'Importer un PGN d’ouverture',
  'openings.importedToUnfiled': 'Importé dans « À classer ».',
  'openings.systemFolder': 'Dossier système',
  'openings.unfiledHint':
    'Destination par défaut. Déplace ensuite tes PGN vers un répertoire Blancs ou Noirs.',
  'openings.createOpeningPgn': 'Créer un PGN d’ouverture',
  'openings.editOpeningPgn': 'Éditer un PGN d’ouverture',
  'openings.createFolderFab': 'Dossier',
  'openings.createFolderA11y': 'Créer un nouveau dossier',
  'openings.saveToAnyChess': 'Sauvegarder dans AnyChess',
  'openings.exportPgn': 'Exporter en PGN',
  'openings.addComment': 'Ajouter un commentaire',
  'openings.editComment': 'Modifier le commentaire',
  'openings.deleteComment': 'Supprimer le commentaire',
  'openings.deleteVariation': 'Supprimer cette variante',
  'openings.goParentLine': 'Revenir à la ligne parente',
  'openings.addAnnotation': 'Ajouter une annotation',
  'openings.createVariationHint':
    'Joue un autre coup depuis cette position pour proposer une nouvelle variante.',
  'openings.confirmVariationTitle': 'Créer une variante ?',
  'openings.confirmVariationBody':
    'Le coup {{move}} n’est pas encore dans l’arbre. L’ajouter comme nouvelle variante ?',
  'openings.unsavedTitle': 'Des modifications ne sont pas sauvegardées.',
  'openings.unsavedBody':
    'Sauvegarder dans AnyChess, quitter sans sauvegarder, ou rester dans l’éditeur.',
  'openings.leaveWithoutSaving': 'Quitter sans sauvegarder',
  'openings.commentPlaceholder': 'Commentaire de ce coup',
  'openings.commentNeedMove': 'Joue un coup pour pouvoir le commenter.',
  'openings.newPgnName': 'Nom du PGN',
  'openings.newPgnNamePlaceholder': 'Nom affiché dans la bibliothèque',
  'openings.newStudyDefault': 'Nouvelle étude',
  'openings.undoEdit': 'Annuler',
  'openings.redoEdit': 'Rétablir',
  'openings.analyzeThisPosition': 'Analyser cette position',
  'openings.returnToEditor': 'Retourner à l’éditeur',
  'openings.addAnalyzedLine': 'Ajouter la ligne analysée au PGN',
  'openings.createStudyFromHere': 'Créer une étude d’ouverture depuis ici',
  'openings.createStudyScopeTitle': 'Contenu de l’étude',
  'openings.createStudyScopeBody':
    'Conserver les coups joués depuis le début de la partie, ou démarrer l’étude depuis la position actuelle ?',
  'openings.createStudyFromStart': 'Depuis le début de la partie',
  'openings.createStudyFromPosition': 'Depuis la position actuelle',
  'openings.createStudyNameTitle': 'Nom de l’étude',
  'openings.branchPickerTitle': 'Quelle continuation ?',
  'openings.mainLine': 'ligne principale',
  'openings.variation': 'variante',
  'openings.returnToCourse': '↩ Revenir au cours',
  'openings.playThisLine': 'Jouer cette ligne',
  'openings.continueThisLine': 'Continuer cette ligne',
  'openings.analyzeGame': 'Analyser la partie',
  'openings.studyThisOpening': 'Étudier cette ouverture',
  'openings.currentMove': 'Coup {{move}}',
  'openings.sideRequired': 'Choisis Blancs ou Noirs pour ce dossier.',
  'openings.learnFolders': 'Dossiers',
  'openings.learnPgns': 'PGN du dossier',
  'openings.linesShort': '{{count}} lignes',
  'openings.pgnMasteryMeta': '{{count}} lignes · {{percent}} % maîtrisé',
  'openings.filterUnmastered': 'Non maîtrisé',
  'openings.filterPartial': 'Partiel',
  'openings.filterMastered': 'Maîtrisé',
  'openings.filterPriority': 'Prioritaires',
  'openings.filterAll': 'Tous',
  'openings.lineMastered': '✓ Maîtrisée',
  'openings.lineToWork': 'À travailler',
  'openings.emptyFilterUnmastered': 'Aucun PGN dans cette catégorie.',
  'openings.emptyFilterPartial': 'Aucun PGN dans cette catégorie.',
  'openings.emptyFilterMastered': 'Aucun PGN maîtrisé pour le moment.',
  'openings.emptyFilterPriority': 'Aucun PGN prioritaire.',
  'openings.emptyFilterAll': 'Aucun PGN à afficher.',
  'openings.priorityA11yOn': 'Retirer le statut prioritaire',
  'openings.priorityA11yOff': 'Marquer comme prioritaire',
  'openings.trainUnmastered': 'Entraîner les lignes à travailler',
  'openings.noUnmasteredLines': 'Toutes les lignes de ce PGN sont maîtrisées.',
  'openings.continueVsEngineShort': 'Continuer contre Stockfish',
  'openings.toggleReview': 'Révision',
  'openings.setSide': 'Camp du dossier',
  'openings.unassignedSideHint':
    'À classer — choisis Blancs ou Noirs. Tant qu’aucun camp n’est choisi, ce dossier reste hors Révision.',
  'openings.toClassify': 'À classer',
  'openings.chooseWhiteOrBlack': 'Choisir Blancs ou Noirs',
  'openings.customSelection': 'Sélection personnalisée…',
  'openings.sideTitle': 'Côté du répertoire',
  'openings.sidePrompt': 'De quel côté travaillez-vous « {{name}} » ?',
  'profil.title': 'Profil',
  'profil.localData': 'Compte AnyChess — données privées synchronisées',
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
  'profil.saveTitle': 'Sauvegarde et synchronisation',
  'profil.saveBody':
    'PGN, dossiers, traductions, révisions, historiques, statistiques et préférences restent utilisables hors ligne, puis se synchronisent.',
  'profil.saveSoon': 'Une sauvegarde locale est créée avant chaque connexion.',
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
  'cloud.section': 'COMPTE',
  'cloud.email': 'E-mail',
  'cloud.password': 'Mot de passe',
  'cloud.signIn': 'Connexion',
  'cloud.signUp': 'Créer un compte',
  'cloud.signOut': 'Déconnexion',
  'cloud.recover': 'Mot de passe oublié',
  'cloud.recoverSent': 'E-mail de récupération envoyé.',
  'cloud.statusSynced': 'Synchronisé',
  'cloud.statusPending': 'En attente',
  'cloud.statusError': 'Erreur de synchronisation',
  'cloud.statusOffline': 'Hors ligne — synchro au retour du réseau',
  'cloud.statusSignedOut': 'Non connecté',
  'cloud.statusUnconfigured': 'Cloud non configuré',
  'cloud.syncNow': 'Synchroniser',
  'cloud.unconfiguredHint':
    'Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (offre gratuite). La clé DeepL reste sur le serveur de traduction.',
  'cloud.signedInAs': 'Connecté : {{email}}',
  'cloud.errorInvalid': 'E-mail ou mot de passe incorrect.',
  'cloud.errorTaken': 'Un compte existe déjà pour cet e-mail.',
  'cloud.errorWeak': 'Mot de passe trop court (6 caractères minimum).',
  'cloud.errorConfirmEmail': 'Confirmez votre e-mail, puis reconnectez-vous.',
  'cloud.errorOffline': 'Réseau indisponible.',
  'cloud.errorRejected': 'La demande a été refusée.',
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
    'Joue aux échecs sur l’échiquier ou à la voix.',
  'modes.openings.title': 'Apprends tes ouvertures',
  'modes.openings.description':
    'Apprends tes ouvertures et entraîne-toi à les rejouer.',
  'modes.blind.title': 'Mémorisation',
  'modes.blind.description':
    'Retiens des suites de coups en les écoutant ou en les regardant.',
  'modes.puzzles.title': 'Entraînement tactique',
  'modes.puzzles.description': 'Résous des problèmes et entraîne tes finales.',
  'modes.visualisation.title': 'Vision de l’échiquier',
  'modes.visualisation.description':
    'Suis les coups mentalement et repère-les sur l’échiquier.',
  'modes.quiz-ouverture.title': 'Culture générale',
  'modes.quiz-ouverture.description':
    'Reconnais les ouvertures et teste tes connaissances.',
  'modes.parties.title': 'Analyses de parties',
  'modes.parties.description':
    'Classe tes parties, rejoue-les et analyse les positions qui t’intéressent.',
  'parties.title': 'Analyses de parties',
  'parties.subtitle':
    'Classe tes parties, rejoue-les et analyse les positions qui t’intéressent.',
  'parties.importPgn': 'Importer un PGN / FEN',
  'parties.importPgnFen': 'Importer un PGN / FEN',
  'parties.startFromInitial': 'Analyse depuis la position de départ',
  'parties.createFolderFab': 'Dossier',
  'parties.createFolderA11y': 'Créer un dossier',
  'parties.unfiledFolder': 'À classer',
  'parties.systemFolder': 'Dossier système',
  'parties.importFilePgn': 'Importer un fichier PGN',
  'parties.pastePgn': 'Coller un PGN',
  'parties.pastePgnPlaceholder': 'Colle un PGN ici…',
  'parties.pasteFen': 'Coller un FEN',
  'parties.pasteFenPlaceholder': 'Colle une position FEN ici…',
  'parties.pgnInvalid': 'PGN invalide ou incomplet.',
  'parties.fenInvalid': 'FEN invalide. Vérifie la position saisie.',
  'parties.saveAnalysis': 'Sauvegarder',
  'parties.savedToUnfiled': 'Enregistrée dans « À classer ».',
  'parties.alreadySaved': 'Cette analyse est déjà enregistrée.',
  'parties.importTitle': 'Importer un PGN / FEN',
  'parties.emptyFolder': 'Aucune analyse dans ce dossier.',
  'parties.moveGame': 'Déplacer vers un dossier',
  'parties.folderLocked': 'Dossier système — non supprimable',
  'parties.anyliseurProfileFastDesc':
    'Analyse quasi immédiate pour naviguer rapidement dans la partie.',
  'parties.anyliseurProfileNormalDesc':
    'Analyse plus précise, avec un temps d’attente modéré.',
  'parties.anyliseurProfileDeepDesc':
    'Analyse approfondie, plus lente.',
  'parties.anyliseurProfileMetric': '~{{ms}} ms · profondeur {{depth}}',
  'parties.empty':
    'Aucune analyse enregistrée. Importe un PGN ou lance une analyse depuis la position de départ, puis sauvegarde.',
  'parties.noMeta': 'Métadonnées indisponibles',
  'parties.moveCount': '{{count}} demi-coups',
  'parties.importOk': '{{count}} partie(s) importée(s)',
  'parties.importProgress': 'Import {{done}} / {{total}}',
  'parties.importRenameOffer':
    'Fichier « {{file}} » importé.\nRenommer ?',
  'parties.multiSelectTitle': 'Sélectionne jusqu’à 10 fichiers PGN à importer.',
  'parties.multiSelectCount': '{{selected}} / {{max}} sélectionnées',
  'parties.gameSelectTitle': 'Sélectionne jusqu’à {{count}} parties à importer.',
  'parties.gameSelectFound': '{{count}} parties trouvées',
  'parties.gameSelectSearch': 'Rechercher (joueur, événement, date…)',
  'parties.gameSelectMax': 'Maximum 10 parties par import.',
  'parties.gameSelectEmpty': 'Aucune partie ne correspond.',
  'parties.gameSelectIndexed': 'Indexé {{count}} parties en {{ms}} ms',
  'parties.importSelectedCount': 'Importer {{count}} parties',
  'parties.newFolder': 'Nouveau dossier',
  'parties.folderDeleteTitle': 'Supprimer le dossier ?',
  'parties.folderDeleteConfirm':
    'Ce dossier contient {{games}} partie(s) et {{folders}} sous-dossier(s).',
  'parties.folderDeleteAll': 'Supprimer le dossier et son contenu',
  'parties.importDuplicates': '{{count}} déjà présente(s)',
  'parties.importSkipped': '{{count}} ignorée(s)',
  'parties.importNone': 'Aucune nouvelle partie importée',
  'parties.importFailed': 'Échec de l’import PGN',
  'parties.deleteTitle': 'Supprimer la partie ?',
  'parties.deleteConfirm': 'Supprimer',
  'parties.voiceCommands': 'Commandes vocales',
  'parties.nameRequired': 'Le nom ne peut pas être vide.',
  'parties.importCancelled': 'Import annulé',
  'parties.importAction': 'Importer',
  'parties.gameNamePlaceholder': 'Ex. Morphy – Duke of Brunswick',
  'parties.gameName': 'Nom de la partie',
  'parties.deleteConfirmMessage': 'Supprimer cette partie ?',
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
  'parties.flipBoard': 'Retourner l’échiquier',
  'parties.anyliseurTabGame': 'Partie',
  'parties.anyliseurTabAnalysis': 'Analyse',
  'parties.anyliseurProfileFast': 'Rapide',
  'parties.anyliseurProfileNormal': 'Moyenne',
  'parties.anyliseurProfileDeep': 'Forte',
  'parties.anyliseurExport': 'Export',
  'parties.anyliseurExportDone': 'PGN enrichi copié.',
  'parties.anyliseurExportFail': 'Impossible de copier le PGN.',
  'parties.anyliseurOpenReader': 'Lecteur',
  'parties.anyliseurArrowsOn': 'Flèche on',
  'parties.anyliseurArrowsOff': 'Flèche off',
  'parties.anyliseurUnavailable': "Le moteur d'analyse n'est pas disponible.",
  'parties.anyliseurRetry': 'Réessayer',
  'parties.anyliseurInitializing': 'Initialisation du moteur…',
  'parties.anyliseurAnalyzing': 'Analyse en cours…',
  'parties.anyliseurReady': 'Moteur prêt',
  'parties.anyliseurProgress': 'Analyse {{done}} / {{total}}',
  'parties.anyliseurProgressMain': 'Analyse ligne principale {{done}} / {{total}}',
  'parties.anyliseurProgressVariants': 'Analyse variantes {{done}} / {{total}}',
  'parties.anyliseurPlayed': 'Joué',
  'parties.anyliseurBest': 'Meilleur',
  'parties.anyliseurBefore': 'Avant',
  'parties.anyliseurAfter': 'Après',
  'parties.anyliseurBestMoves': 'Meilleurs coups',
  'parties.anyliseurWaiting': 'En attente de lignes…',
  'parties.anyliseurMore': 'Plus de détails',
  'parties.anyliseurLess': 'Moins',
  'parties.anyliseurCurve': "Courbe d'évaluation",
  'parties.anyliseurAnalyzed': 'Analysée',
  'parties.anyliseurReanalyze': 'Ré-analyser',
  'parties.anyliseurExportIncludeEvals': 'Inclure les évaluations',
  'parties.anyliseurExportCopyPgn': 'Copier le PGN',
  'parties.anyliseurExportDownloadPgn': 'Télécharger le PGN',
  'parties.anyliseurExportCopyFen': 'Copier la FEN',
  'parties.anyliseurExportDownloadFen': 'Télécharger la FEN',
  'parties.anyliseurImportFile': 'Importer un fichier PGN',
  'parties.anyliseurImportPaste': 'Coller un PGN ou une FEN',
  'parties.anyliseurImportLibrary': 'Choisir dans la bibliothèque',
  'parties.anyliseurImportInvalid': 'Import invalide — la partie actuelle est conservée.',
  'parties.anyliseurMultiGameChoice': 'Plusieurs parties détectées — choisissez-en une.',
  'parties.anyliseurFenLoaded': 'Position FEN chargée.',
  'parties.anyliseurA11yFlip': 'Retourner l’échiquier',
  'parties.anyliseurA11yFlipHint': 'Inverse la vue des camps blanc et noir',
  'parties.anyliseurA11yArrowsHint': 'Affiche ou masque la flèche du meilleur coup',
  'parties.anyliseurA11yProfile': 'Profil d’analyse',
  'parties.anyliseurA11yProfileHint': 'Choisir le temps de calcul du moteur',
  'parties.anyliseurA11yImport': 'Importer un PGN',
  'parties.anyliseurA11yImportHint': 'Charger une nouvelle partie depuis un PGN',
  'parties.anyliseurA11yExportHint': 'Copier le PGN enrichi dans le presse-papiers',
  'parties.anyliseurA11yOpenReaderHint': 'Ouvrir la même position dans le Lecteur',
  'parties.anyliseurA11yReturn': 'Revenir à l’origine d’exploration',
  'parties.anyliseurA11yReturnHint': 'Retourne au point avant les coups d’exploration',
  'parties.anyliseurProfileTitle': 'Profil d’analyse',
  'parties.anyliseurProfileHint':
    'Ces modes règlent le temps de recherche et la profondeur maximale du moteur, pas la difficulté.',
  'parties.anyliseurProfileClose': 'Fermer le profil d’analyse',
  'parties.analyzer': 'AnyLyseur',
  'parties.analyzerSubtitle': 'Analyse de partie et de position',
  'parties.analyzerEmpty': 'Colle un PGN pour démarrer AnyLyseur.',
  'parties.analyzerPaste': 'Colle un PGN ici…',
  'parties.analyzerLoad': 'Charger',
  'parties.parseError': 'Impossible de lire cette partie.',
  'parties.parseErrorHint': 'Vérifie le PGN (coups, en-têtes) puis réessaie.',
  'parties.openAnalyzer': 'Ouvrir AnyLyseur',
  'parties.openWorkspace': 'Analyse depuis la position de départ',
  'parties.workspace': 'Analyse de partie',
  'parties.workspaceSubtitle': 'Partie et analyse — un seul état',
  'game.movesPlayed': 'Coups joués',
  'game.exportPgn': 'Exporter en PGN',
  'game.export': 'Exporter',
  'game.yourTurn': 'À toi de jouer.',
  'game.opponentThinking': "L'adversaire réfléchit…",
  'game.opponentPreparing': "L'adversaire prépare son coup…",
  'game.opponentFailed': "Le moteur n'a pas pu jouer ce coup.",
  'game.opponentRetry': 'Réessayer',
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
  'errors.systemFolderProtected': 'Ce dossier système ne peut pas être modifié.',
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
  'openings.moveOr': ' ou ',
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
    'Écoute des coups, puis rejoue-les dans le bon ordre.',
  'blind.watchRecite': 'Regarder puis réciter',
  'blind.watchReciteDesc':
    'Regarde des coups, puis récite-les à voix haute.',
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
    'Exerce-toi à suivre les coups et à visualiser les positions.',
  'vision.mental': 'Suivi mental de position',
  'vision.mentalDesc':
    'Suis les coups de tête, puis retrouve la position.',
  'vision.nommer': 'Nommer le coup',
  'vision.nommerDesc': 'Regarde un coup et donne son nom.',
  'vision.jouer': 'Jouer le coup',
  'vision.jouerDesc': 'Lis un coup et joue-le sur l’échiquier.',
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
    'Découvre les ouvertures et teste tes connaissances sur les échecs.',
  'quiz.quiz': 'Quiz',
  'quiz.culture': 'Culture échiquéenne',
  'quiz.cultureDesc':
    'Réponds à des questions sur le monde des échecs.',
  'quiz.cultureMixed': 'Culture échiquéenne — 10 questions mixtes',
  'quiz.quelle': 'Quelle ouverture ?',
  'quiz.quelleDesc':
    'Devine l’ouverture à partir des coups joués.',
  'quiz.defendsNulle': 'Défends la nulle !',
  'quiz.defendsNullePageTitle': 'Entraînement aux Finales',
  'quiz.defendsNulleDesc':
    'Tiens une position égale face à Stockfish.',
  'quiz.defendsNulleLead':
    'Choisis une nouvelle finale ou rejoue une position de Essaie encore !',
  'quiz.defendsNulleProgress': 'Coups joués : {{current}}',
  'quiz.defendsNulleThinking': 'Stockfish analyse…',
  'quiz.defendsNullePreparing': 'Préparation de Stockfish…',
  'quiz.defendsNulleReflecting': 'Stockfish réfléchit…',
  'quiz.defendsNulleLoading': 'Chargement…',
  'quiz.defendsNulleAgain': 'Nouvelle position',
  'quiz.defendsNulleNext': 'Position suivante',
  'quiz.defendsNulleContinue': 'Continuer',
  'quiz.defendsNulleRestart': 'Recommencer',
  'quiz.defendsNulleAnother': 'Jouer une autre finale',
  'quiz.defendsNulleEngineUnavailable':
    'Stockfish n’est pas disponible sur cette version de l’application.',
  'quiz.stockfishPreparing': 'Préparation de Stockfish…',
  'quiz.stockfishWebError':
    'Stockfish n’a pas pu démarrer dans ce navigateur.',
  'quiz.stockfishNativeUnavailable':
    'Stockfish n’est pas encore disponible sur cette plateforme mobile.',
  'quiz.stockfishRetry': 'Réessayer',
  'quiz.stockfishBack': 'Retour',
  'quiz.positionNotFound': 'Cette position est introuvable.',
  'quiz.stockfishDevDetail':
    'Statut : {{status}}\nErreur : {{error}}\nWorker : {{worker}}',
  'quiz.endgameNewFinales': 'Nouvelles Finales !',
  'quiz.endgameNewFinalesDesc':
    'Une position aléatoire et variée que tu n’as jamais terminée.',
  'quiz.endgameTryAgain': 'Essaie encore !',
  'quiz.endgameTryAgainDesc':
    'Rejoue une position que tu as choisie d’ajouter après une tentative.',
  'quiz.endgameTryAgainEmpty':
    'Aucune position pour l’instant. Tu pourras en ajouter après une tentative perdue.',
  'quiz.endgamePoolExhausted':
    'Tu as terminé toutes les nouvelles positions disponibles. Reviens plus tard ou ouvre Essaie encore !',
  'quiz.endgamePoolPreparing':
    'De nouvelles finales sont en préparation.',
  'quiz.endgameMovesResisted': 'Coups résistés : {{count}}',
  'quiz.endgameHideGauge': 'Masquer la jauge',
  'quiz.endgameShowGauge': 'Afficher la jauge',
  'quiz.endgameOffScore': 'Suite hors score',
  'quiz.endgameVerifying': 'Vérification…',
  'quiz.endgameThisAttempt': 'Cette tentative : {{count}} coups',
  'quiz.endgamePrevAttempt': 'Tentative précédente : {{count}} coups',
  'quiz.endgameBestAttempt': 'Meilleure tentative : {{count}} coups',
  'quiz.endgameAnalyse': 'Analyse !',
  'quiz.analyseGame': 'Analyser la partie',
  'quiz.analysePosition': 'Analyser la position',
  'quiz.endgameAddTryAgain': 'Ajouter à Essaie encore',
  'quiz.endgameAddedTryAgain': 'Ajoutée à Essaie encore',
  'quiz.endgameRetry': 'Retenter',
  'quiz.endgameContinuePosition': 'Continuer la position',
  'quiz.endgameContinueOffScore': 'Continuer hors score',
  'quiz.endgameRemoveTryAgain': 'Retirer de Essaie encore',
  'quiz.endgameBackMenu': 'Retour au menu',
  'quiz.endgameObjectiveWin': 'Objectif : gagne cette finale',
  'quiz.endgameObjectiveDraw': 'Objectif : sauve la nulle',
  'quiz.endgameOfferDraw': 'Proposer la nulle',
  'quiz.endgameCopyFen': 'Copier le FEN',
  'quiz.endgameFenCopied': 'FEN copié !',
  'quiz.endgameReplay': 'Rejouer la finale',
  'quiz.theoreticalEndgameTitle': 'Finales théoriques',
  'quiz.theoreticalEndgameDesc':
    'Choisis une finale et entraîne-toi à la jouer.',
  'quiz.theoreticalEndgameLead': 'Travaille les finales essentielles par répétition.',
  'quiz.theoreticalRandom': 'Aléatoire',
  'quiz.theoreticalViewList': 'Liste',
  'quiz.theoreticalViewCards': 'Cartes',
  'quiz.theoreticalAllMastered': 'Tous les thèmes sont maîtrisés — position aléatoire du pool.',
  'quiz.theoreticalNoAttempts': '—/10',
  'quiz.theoreticalCompleted': 'Terminé',
  'quiz.theoreticalObjectiveWin': 'Gagne la position',
  'quiz.theoreticalObjectiveDraw': 'Obtiens la nulle',
  'quiz.theoreticalMovesPlayed': 'Coups joués : {{count}} / cible {{target}}',
  'quiz.theoreticalOffScore': 'Suite hors score',
  'quiz.theoreticalVerifying': 'Vérification…',
  'quiz.theoreticalAnalyse': 'Analyser',
  'quiz.theoreticalRetry': 'Retenter',
  'quiz.theoreticalNext': 'Suivante',
  'quiz.theoreticalContinueOffScore': 'Continuer hors score',
  'quiz.theoreticalBackThemes': 'Retour aux thèmes',
  'quiz.theoreticalExitTitle': 'Quitter cette finale ?',
  'quiz.theoreticalExitBody':
    'Cette tentative sera abandonnée et ne modifiera pas ta note.',
  'quiz.theoreticalExitContinue': 'Continuer la finale',
  'quiz.theoreticalExitConfirm': 'Quitter',
  'quiz.theoreticalScoreOld': 'Ancienne note : {{score}}',
  'quiz.theoreticalScoreNew': 'Nouvelle note : {{score}}',
  'quiz.theoreticalScoreAttempts': '{{count}} tentative(s) comptabilisée(s)',
  'quiz.theoreticalThemeQueenMate': 'Dame et roi contre roi',
  'quiz.theoreticalThemeRookMate': 'Tour et roi contre roi',
  'quiz.theoreticalThemeTwoBishopsMate': 'Deux fous contre roi',
  'quiz.theoreticalThemePawnSquare': 'Carré du pion',
  'quiz.theoreticalThemeOpposition': 'Opposition',
  'quiz.theoreticalThemeKpVsK': 'Roi et pion contre roi',
  'quiz.theoreticalThemePawnRace': 'Course de pions',
  'quiz.theoreticalThemePawnBreakthrough': 'Percée de pions',
  'quiz.theoreticalThemeThreePawns': 'Trois pions contre trois pions',
  'quiz.theoreticalThemeLucena': 'Position de Lucena',
  'quiz.theoreticalThemePhilidor': 'Position de Philidor',
  'quiz.theoreticalExplainLink': 'Explication de la finale',
  'quiz.theoreticalExplainPrinciple': 'Principe',
  'quiz.theoreticalExplainSeek': 'Ce qu’il faut chercher',
  'quiz.theoreticalExplainMethod': 'Méthode',
  'quiz.theoreticalExplainAvoid': 'Erreur à éviter',
  'quiz.theoreticalExplainPlay': 'Jouer cette finale',
  'quiz.theoreticalExplainClose': 'Fermer',
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
  'quiz.pickLevel': 'Choisis ton niveau',
  'quiz.notEnoughLines':
    'Pas assez d’ouvertures pour ce niveau ({{available}} / {{needed}}). Choisis un autre niveau.',
  'quiz.reviewQuestions': 'Revoir les questions',
  'quiz.changeLevel': 'Changer de niveau',
  'quiz.seeRecords': 'Voir les records',
  'quiz.replaySameLevel': 'Rejouer ce niveau',
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
  'records.cat.openingQuiz': 'Quelle ouverture',
  'records.cat.tacticsDesc': 'Meilleures séries de problèmes par bande de difficulté',
  'records.cat.namingDesc': 'Meilleur score en 60 secondes (Vision de l’échiquier)',
  'records.cat.playDesc': 'Meilleur score en 60 secondes (Vision de l’échiquier)',
  'records.cat.blindDesc':
    'Meilleur nombre de coups complets à 100 % sans aide ni erreur',
  'records.cat.openingQuizDesc':
    'Meilleur score sur 10 questions, par niveau de difficulté',
  'records.subtitle': 'Tes meilleurs scores déjà enregistrés sur cet appareil',
  'records.best60': 'Meilleur score / 60 s',
  'records.bestOutOfTen': 'Meilleur score / 10',
  'records.resetTactics': 'Réinitialiser les records tactiques',
  'records.emptyTactics':
    'Aucun record pour l’instant — résous des problèmes pour en enregistrer.',
  'records.emptyOpeningQuiz':
    'Aucun record pour l’instant — joue Quelle ouverture ? pour en enregistrer.',
  'records.blindResetBody':
    'Cette action remettra à zéro les records Écouter puis reconstruire et Regarder puis réciter.',
  'records.tacticsResetBody':
    'Cette action effacera toutes les meilleures séries enregistrées.',
  'records.openingQuizResetBody':
    'Cette action remettra à zéro les meilleurs scores Quelle ouverture ? pour tous les niveaux.',
  'records.sessionResetTitle': 'Réinitialiser le record ?',
  'records.sessionResetBody':
    'Cette action remettra à zéro le meilleur score 60 secondes de {{label}}.',
  'records.blindHint':
    'Meilleur nombre de coups complets à 100 %, sans aide ni erreur.',
  'records.openingQuizHint': 'Meilleur score sur 10 questions, par niveau.',
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
    'Crée d’abord un dossier, puis importe un PGN d’ouverture à travailler.',
  'openings.emptyLead':
    'Commence par créer un dossier d’ouvertures. Tu pourras ensuite y importer un fichier PGN.',
  'openings.emptySources':
    'Les PGN viennent de ton logiciel d’échecs, d’une base de parties, d’un répertoire que tu as préparé, ou d’un service qui exporte en PGN.',
  'openings.emptyPurpose':
    'AnyChess utilisera les variantes de ton fichier pour te les faire rejouer et t’aider à les mémoriser.',
  'openings.createFolder': 'Créer un dossier',
  'openings.pickFolderTitle': 'Choisir un dossier d’ouvertures',
  'openings.pickFolderHint':
    'Chaque PGN doit aller dans un dossier existant. Crée-en un si besoin — aucun dossier « Non classées » n’est créé automatiquement.',
  'openings.pickFolderEmpty':
    'Aucun dossier pour l’instant. Crée un dossier avant d’importer.',
  'openings.renameDisplayName': 'Renommer',
  'openings.renameDisplayPlaceholder': 'Nom affiché dans AnyChess',
  'openings.moveToFolder': 'Déplacer',
  'openings.addToOpeningsFolder': 'Ajouter à un dossier d’ouvertures',
  'openings.addToOpeningsDone': 'Partie ajoutée au répertoire « {{name}} ».',
  'openings.addToOpeningsFail': 'Impossible d’ajouter la partie au répertoire.',
  'openings.noPgnInGame': 'Aucun PGN disponible pour cette partie.',
  'openings.importNeedsFolder':
    'Choisis ou crée un dossier avant d’importer un PGN.',
  'openings.linesCount': '{{count}} ligne(s)',
  'openings.sectionWhite': 'RÉPERTOIRE BLANCS',
  'openings.sectionBlack': 'RÉPERTOIRE NOIRS',
  'openings.sectionUnassigned': 'À CLASSER',
  'openings.sectionUnassignedHint':
    'Dossiers sans camp (données conservées). Choisis Blancs ou Noirs pour les inclure en Révision.',
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
  'openings.emptyPgnBody':
    'Importe un ou plusieurs fichiers .pgn dans ce dossier.',
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
    'Travaille ta mémoire en retenant des suites de coups à l’oreille ou à l’œil.',
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
    'Résous des problèmes, entraîne tes finales et apprends à défendre une position.',
  'puzzle.mode': 'Mode',
  'puzzle.visual': 'Visuel',
  'puzzle.blind': 'À l’aveugle',
  'puzzle.difficulty': 'Difficulté',
  'puzzle.visualCardTitle': 'Problèmes visuels',
  'puzzle.visualCardDesc': 'Trouve la solution directement sur l’échiquier.',
  'puzzle.blindCardTitle': 'Problèmes à l’aveugle',
  'puzzle.blindCardDesc': 'Trouve la solution sans voir toute la position.',
  'puzzle.difficultyDefaultHint':
    'La difficulté par défaut peut être modifiée dans Paramètres.',
  'settings.problemDifficulty': 'DIFFICULTÉ DES PROBLÈMES',
  'settings.visualProblemDifficulty': 'Difficulté problèmes visuels',
  'settings.blindProblemDifficulty': 'Difficulté problèmes à l’aveugle',
  'settings.engineStrength': 'NIVEAU MOTEUR',
  'settings.stockfishStrength': 'Niveau adversaire Stockfish',
  'settings.stockfishStrengthHint':
    'Utilisé en Partie classique et lorsque tu sors du répertoire en Ouvertures.',
  'settings.translation': 'Traduction',
  'settings.translateExistingPgn':
    'Traduire les commentaires des PGN déjà importés',
  'settings.translateImportedPgn':
    'Traduire les commentaires des PGN à l’importation',
  'settings.translationNone': 'Aucun commentaire à traduire.',
  'settings.translationProgress':
    'Traduction en cours : {{done}} / {{total}} commentaires.',
  'settings.translationProgressHint':
    '{{done}} commentaires déjà traduits sur {{total}} commentaires anglais à traiter (variantes comprises). Un commentaire en attente ou en échec n’est pas compté comme traduit.',
  'settings.translationPaused': 'Traduction suspendue.',
  'settings.translationComplete': 'Traduction terminée.',
  'settings.translationRetry': 'Réessayer',
  'settings.translationDiagTitle': 'Diagnostic traduction (à copier)',
  'settings.translationDiagCopy': 'Copier le diagnostic',
  'settings.translationDiagCopied': 'Diagnostic copié',
  'settings.translationTimeout':
    'Délai dépassé — la requête de traduction n’a pas abouti.',
  'settings.translationRateLimited':
    'Le service limite temporairement les requêtes. Les commentaires déjà traduits sont conservés. Réessayez dans un instant.',
  'settings.translationCounts':
    '{{done}} traduits · {{pending}} en attente · {{failed}} en échec',
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
  'activity.resumeTitle': 'Activités en cours',
  'activity.resumeCta': 'Reprendre',
  'activity.discardPartieTitle': 'Quitter la partie ?',
  'activity.discardPartieBody':
    'Vous allez perdre votre partie en cours. Voulez-vous vraiment quitter ?',
  'activity.discardPartieConfirm': 'Quitter la partie',
  'activity.discardProblemeTitle': 'Quitter le problème ?',
  'activity.discardProblemeBody':
    'Vous allez perdre votre problème en cours. Voulez-vous vraiment quitter ?',
  'activity.discardProblemeConfirm': 'Quitter le problème',
  'activity.discardQuizTitle': 'Quitter le quiz ?',
  'activity.discardQuizBody':
    'Vous allez perdre votre quiz en cours. Voulez-vous vraiment quitter ?',
  'activity.discardQuizConfirm': 'Quitter le quiz',
  'activity.discardCoursTitle': 'Quitter le cours ?',
  'activity.discardCoursBody':
    'Vous allez perdre votre cours en cours. Voulez-vous vraiment quitter ?',
  'activity.discardCoursConfirm': 'Quitter le cours',
  'activity.discardExerciceTitle': 'Quitter l’exercice ?',
  'activity.discardExerciceBody':
    'Vous allez perdre votre exercice en cours. Voulez-vous vraiment quitter ?',
  'activity.discardExerciceConfirm': 'Quitter l’exercice',
  'activity.quitCta': 'Quitter',
  'activity.endPartieTitle': 'Quitter cette partie ?',
  'activity.endPartieBody': 'La partie en cours ne pourra plus être reprise.',
  'activity.endExerciceTitle': 'Quitter cet exercice ?',
  'activity.endExerciceBody': 'Votre progression actuelle sera perdue.',
  'activity.endAnalyseTitle': 'Quitter cette analyse ?',
  'activity.endAnalyseBody': 'L’analyse en cours ne pourra plus être reprise.',
  'activity.endQuizTitle': 'Quitter ce quiz ?',
  'activity.endQuizBody': 'Votre progression actuelle sera perdue.',
  'activity.endTrainingTitle': 'Quitter cet entraînement ?',
  'activity.endTrainingBody': 'Votre progression actuelle sera perdue.',
  'activity.continueGame': 'Continuer',
  'activity.continueExercise': 'Continuer l’exercice',
  'activity.continueTraining': 'Continuer l’entraînement',
  'activity.abandonTitle': 'Abandonner cette partie ?',
  'activity.abandonBody': 'La partie en cours ne pourra plus être reprise.',
  'activity.abandonConfirm': 'Abandonner',
  'activity.backPartieTitle': 'Quitter la partie ?',
  'activity.backExerciceTitle': 'Abandonner l’exercice ?',
  'activity.backExerciceConfirm': 'Abandonner',
  'home.tagline': 'Jouer. Apprendre. Visualiser.',
  'board.gameContinues': 'La partie continue normalement.',
  'board.show': 'Afficher',
  'campPicker.title': 'Choix du camp',
  'campPicker.randomSide': 'Camp aléatoire',
  'campPicker.hint': 'Touche les pièces Blanches ou Noires, ou choisis un camp aléatoire.',
  'exercise.referenceCopied': 'Référence copiée',
  'exercise.tryAgainAlready': 'Déjà dans « Essaie encore ! »',
  'exercise.tryAgainAddTitle': 'Ajouter cette position à « Essaie encore ! » ?',
  'review.bestMove': 'Meilleur coup : {{san}}',
  'review.returnToPosition': 'Retour à la position',
  'review.finishGameTitle': 'Finir la partie ?',
  'review.finishGameBody': 'Le résultat de l’exercice ne sera pas modifié.',
  'review.backToResult': 'Retour au résultat',
  'review.finishGame': 'Finir la partie',
  'puzzle.bandRandomAll': 'Aléatoire / Tous',
  'profil.eloUnrated': 'Non classé',
  'openings.noPlayableLine': 'Aucune ligne jouable dans ce répertoire.',
  'vision.answerRecorded': 'Réponse enregistrée',
  'vision.insufficientQuestions': 'Pas assez de questions fiables.',
  'endgame.drawStalemate': 'Nulle obtenue par pat. Bien joué !',
  'endgame.drawThreefold': 'Nulle obtenue par répétition. Bien joué !',
  'endgame.drawInsufficient': 'Nulle par matériel insuffisant. Bien joué !',
  'endgame.drawFifty': 'Nulle obtenue par la règle des 50 coups. Bien joué !',
  'endgame.drawDefended': 'Nulle — position défendue',
  'endgame.drawGeneric': 'Nulle obtenue. Bien joué !',
  'endgame.defendedThirty': 'Finale défendue ! Tu as résisté 30 coups.',
  'endgame.checkmateWin': 'Échec et mat. Partie gagnée !',
  'endgame.checkmateLoss': 'Échec et mat. Partie perdue.',
  'endgame.positionWon': 'Position gagnée !',
  'endgame.drawAchieved': 'Nulle obtenue !',
  'endgame.illegalMove': 'Coup illégal.',
  'endgame.heldMoves': 'Tu as résisté {{count}} coups',
  'endgame.evalChanged': 'L’évaluation est passée de {{before}} à {{after}}.',
  'endgame.noReliableAlternative': 'Aucune alternative suffisamment fiable n’a pu être confirmée.',
  'endgame.drawAltOne': 'La nulle pouvait être conservée avec : {{san}}.',
  'endgame.drawAltTwo': 'La nulle pouvait être conservée avec : {{first}} ou {{second}}.',
  'endgame.drawAltThree': 'La nulle pouvait être conservée avec : {{first}}, {{second}} ou {{third}}.',
  'endgame.drawAltThreeMore':
    'Parmi les coups qui permettaient de conserver la nulle : {{first}}, {{second}} et {{third}}. D’autres coups maintenaient également l’équilibre.',
  'endgame.noMajorMistake':
    'Aucune grosse erreur. La position s’est détériorée petit à petit.',
  'endgame.firstTurn': 'Premier tournant : {{move}}.{{san}}',
  'endgame.stockfishUnavailable': 'Stockfish indisponible.',
  'endgame.engineError': 'Erreur moteur.',
  'endgame.moveNotRecognized': 'Coup non reconnu.',
  'endgame.drawDefendedShort': 'Nulle ! Finale défendue.',
  'endgame.mateDefended': 'Mat ! Finale défendue.',
  'theoretical.lostOnMove': 'Résultat théorique perdu au coup {{count}}.',
  'theoretical.gameOver': 'Partie terminée.',
  'theoretical.drawObtained': 'Nulle obtenue.',
  'errors.illegalSan': 'Coup illégal « {{san}} ».',
  'errors.invalidStartFen': 'FEN de départ invalide.',
  'errors.malformedPgn': 'PGN mal formé.',
  'errors.noGamesFound': 'Aucune partie trouvée.',
  'openings.leftRepertoire': 'Sortie du répertoire avec {{move}}',
  'openings.endOfTheory': 'Fin de la ligne théorique importée après {{move}}',
  'position.refPrefix': 'Réf.',
  'quiz.defendsNulleDefendNext': 'Défendre la finale suivante',
  'pgn.commentOriginal': 'Original',
  'pgn.commentFrench': 'Français',
  'pgn.translateComments': 'Traduire les commentaires en français',
  'pgn.completeTranslation': 'Compléter la traduction',
  'pgn.retryTranslation': 'Réessayer la traduction',
  'pgn.translateSelection': 'Traduire la sélection',
  'pgn.translateAllExisting': 'Traduire tous les PGN existants',
  'pgn.translating': 'Traduction en cours',
  'pgn.translationPending': 'En attente',
  'pgn.translationPartial': 'Traduction partielle',
  'pgn.translationUnavailable': 'Traduction indisponible',
  'pgn.translationQueued': 'Traduction en file d’attente',
  'pgn.serviceNotConfigured':
    'La traduction automatique n’est pas configurée : le serveur DeepL n’est pas joignable ou la clé serveur est absente. Les originaux restent affichés.',
  'pgn.translationQuota':
    'Quota mensuel DeepL Free atteint (500 000 caractères par mois). Les commentaires déjà traduits sont conservés. Les autres restent en file, avec l’original affiché.',
  'pgn.translationQuotaResume': 'Le fournisseur indique une reprise dans {{delay}}.',
  'pgn.translationUsage': 'Consommation DeepL : {{used}} / {{limit}} caractères ce mois-ci.',
  'pgn.translationFailed':
    'La traduction a échoué. Les commentaires originaux sont conservés.',
  'pgn.importNotice': 'Les commentaires textuels en anglais seront envoyés au service de traduction pour préparer une version française. L’import reste disponible tout de suite.',
  'pgn.batchProgress': '{{done}} / {{total}} commentaires',
  'pgn.exportOriginal': 'Exporter l’original',
  'pgn.exportFrench': 'Exporter avec commentaires français',
  'pgn.exportBilingual': 'Exporter bilingue',
  'pgn.languageUnknown': 'Langue indéterminée — original conservé',
  'pgn.cancelBatch': 'Annuler la traduction',
  'pgn.resumeBatch': 'Reprendre la traduction',
  'pgn.offlineQueued': 'Hors ligne — la traduction reprendra lorsque le service sera disponible.',
  'pgn.catchupHint': 'Des PGN importés n’ont pas encore de version française de leurs commentaires.',
  'pgn.alreadyFrench': 'Commentaires déjà en français.',
  'speech.micDenied': 'Microphone refusé. Tu peux autoriser l’accès dans les réglages.',
  'speech.micUnavailable': 'La reconnaissance vocale n’est pas disponible.',
  'speech.unavailableBrowser':
    'La reconnaissance vocale n’est pas disponible dans ce navigateur. Utilise Chrome/Edge, ou saisis le coup au clavier.',
  'speech.micDeniedBrowser': 'Permission microphone refusée. Autorise le micro dans le navigateur.',
  'speech.micUnavailableDevice': 'Microphone indisponible sur cet appareil / navigateur.',
  'speech.micPermissionFailed': 'Impossible de demander la permission microphone.',
  'speech.startFailed': 'Échec du démarrage de la reconnaissance vocale.',
  'speech.unsupported': 'Reconnaissance vocale non supportée ici.',
  'speech.micError': 'Erreur micro : {{code}}',
  'speech.nothingRecognized': 'Rien d’utilisable reconnu. Réessaie.',
  'vision.answerUnrecognized': 'Non reconnu — réessaie (non compté).',
  'errors.folderParentMissing': 'Dossier parent introuvable.',
  'errors.systemFolderDelete': 'Ce dossier système ne peut pas être supprimé.',
  'game.exportOrAnalyze': 'Exporter ou analyser…',
  'game.exportNo': 'Non',
  'game.exportYes': 'Oui',
  'blind.reciteSequence': 'Récite la séquence à voix haute, coup par coup.',
  'puzzle.illegalHere': 'Illégal ici ({{detail}}). Non compté comme erreur de coup.',
  'activity.openingTraining': 'Entraînement d’ouverture',
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
  'common.yes': 'Yes',
  'common.no': 'No',
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
  'game.abandonShort': 'Resign',
  'game.quitExerciseShort': 'Leave exercise',
  'game.quitTrainingShort': 'Leave training',
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
  'openings.learn': 'Learning',
  'openings.learnHint':
    'Study each opening separately, with comments and variations.',
  'openings.managePgn': 'Import / manage my PGNs',
  'openings.manageTitle': 'My opening PGNs',
  'openings.hubLead':
    'Discover your openings, then practice finding the right moves.',
  'openings.hubReviewHint': 'Find the right moves of your openings.',
  'openings.hubLearnHint':
    'Browse your openings at your own pace, move by move.',
  'openings.reviewPoolSummary': '{{pgn}} active PGNs · {{lines}} lines available',
  'openings.activePgnList': 'PGNs included in Review',
  'openings.noActivePgn':
    'No active PGN. Enable a folder and at least one PGN in the library.',
  'openings.folderActive': 'Active for Review',
  'openings.folderInactive': 'Inactive for Review',
  'openings.viewPgn': 'View / Study',
  'openings.changeSideConfirmTitle': 'Change side?',
  'openings.changeSideConfirmBody':
    'This PGN will move from a {{from}} folder to a {{to}} folder. Training orientation will follow the new folder.',
  'openings.noComment': 'No comment for this move.',
  'openings.tabComments': 'Comments',
  'openings.tabNotation': 'Notation',
  'openings.annotatePgn': 'Annotate / edit',
  'openings.annotateThisPgn': 'Annotate this PGN',
  'openings.createPgn': 'Create a PGN',
  'openings.importOpeningPgn': 'Import an opening PGN',
  'openings.importTitle': 'Import an opening PGN',
  'openings.importedToUnfiled': 'Imported into “Unsorted”.',
  'openings.systemFolder': 'System folder',
  'openings.unfiledHint':
    'Default destination. Move PGNs into a White or Black repertoire afterwards.',
  'openings.createOpeningPgn': 'Create an opening PGN',
  'openings.editOpeningPgn': 'Edit an opening PGN',
  'openings.createFolderFab': 'Folder',
  'openings.createFolderA11y': 'Create a new folder',
  'openings.saveToAnyChess': 'Save to AnyChess',
  'openings.exportPgn': 'Export PGN',
  'openings.addComment': 'Add a comment',
  'openings.editComment': 'Edit the comment',
  'openings.deleteComment': 'Delete the comment',
  'openings.deleteVariation': 'Delete this variation',
  'openings.goParentLine': 'Back to the parent line',
  'openings.addAnnotation': 'Add an annotation',
  'openings.createVariationHint':
    'Play a different move from this position to propose a new variation.',
  'openings.confirmVariationTitle': 'Create a variation?',
  'openings.confirmVariationBody':
    '{{move}} is not in the tree yet. Add it as a new variation?',
  'openings.unsavedTitle': 'Some changes are not saved.',
  'openings.unsavedBody':
    'Save to AnyChess, leave without saving, or stay in the editor.',
  'openings.leaveWithoutSaving': 'Leave without saving',
  'openings.commentPlaceholder': 'Comment for this move',
  'openings.commentNeedMove': 'Play a move before adding a comment.',
  'openings.newPgnName': 'PGN name',
  'openings.newPgnNamePlaceholder': 'Name shown in the library',
  'openings.newStudyDefault': 'New study',
  'openings.undoEdit': 'Undo',
  'openings.redoEdit': 'Redo',
  'openings.analyzeThisPosition': 'Analyse this position',
  'openings.returnToEditor': 'Back to the editor',
  'openings.addAnalyzedLine': 'Add the analysed line to the PGN',
  'openings.createStudyFromHere': 'Create an opening study from here',
  'openings.createStudyScopeTitle': 'Study contents',
  'openings.createStudyScopeBody':
    'Keep the moves played from the start of the game, or start the study from the current position?',
  'openings.createStudyFromStart': 'From the start of the game',
  'openings.createStudyFromPosition': 'From the current position',
  'openings.createStudyNameTitle': 'Study name',
  'openings.branchPickerTitle': 'Which continuation?',
  'openings.mainLine': 'main line',
  'openings.variation': 'variation',
  'openings.returnToCourse': '↩ Back to the lesson',
  'openings.playThisLine': 'Play this line',
  'openings.continueThisLine': 'Continue this line',
  'openings.analyzeGame': 'Analyse the game',
  'openings.studyThisOpening': 'Study this opening',
  'openings.currentMove': 'Move {{move}}',
  'openings.sideRequired': 'Choose White or Black for this folder.',
  'openings.learnFolders': 'Folders',
  'openings.learnPgns': 'Folder PGNs',
  'openings.linesShort': '{{count}} lines',
  'openings.pgnMasteryMeta': '{{count}} lines · {{percent}}% mastered',
  'openings.filterUnmastered': 'Unmastered',
  'openings.filterPartial': 'Partial',
  'openings.filterMastered': 'Mastered',
  'openings.filterPriority': 'Priority',
  'openings.filterAll': 'All',
  'openings.lineMastered': '✓ Mastered',
  'openings.lineToWork': 'To work on',
  'openings.emptyFilterUnmastered': 'No PGN in this category.',
  'openings.emptyFilterPartial': 'No PGN in this category.',
  'openings.emptyFilterMastered': 'No mastered PGN yet.',
  'openings.emptyFilterPriority': 'No priority PGN.',
  'openings.emptyFilterAll': 'No PGN to show.',
  'openings.priorityA11yOn': 'Remove priority',
  'openings.priorityA11yOff': 'Mark as priority',
  'openings.trainUnmastered': 'Train lines to work on',
  'openings.noUnmasteredLines': 'Every line in this PGN is mastered.',
  'openings.continueVsEngineShort': 'Continue vs Stockfish',
  'openings.toggleReview': 'Review',
  'openings.setSide': 'Folder side',
  'openings.unassignedSideHint':
    'To sort — choose White or Black. Until a side is chosen, this folder stays out of Review.',
  'openings.toClassify': 'To sort',
  'openings.chooseWhiteOrBlack': 'Choose White or Black',
  'openings.customSelection': 'Custom selection…',
  'openings.sideTitle': 'Repertoire side',
  'openings.sidePrompt': 'Which side are you training “{{name}}” as?',
  'profil.title': 'Profile',
  'profil.localData': 'AnyChess account — private data synced',
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
  'profil.saveTitle': 'Backup and sync',
  'profil.saveBody':
    'PGN files, folders, translations, reviews, histories, stats and preferences stay available offline, then sync.',
  'profil.saveSoon': 'A local backup is created before each sign-in.',
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
  'cloud.section': 'ACCOUNT',
  'cloud.email': 'Email',
  'cloud.password': 'Password',
  'cloud.signIn': 'Sign in',
  'cloud.signUp': 'Create account',
  'cloud.signOut': 'Sign out',
  'cloud.recover': 'Forgot password',
  'cloud.recoverSent': 'Recovery email sent.',
  'cloud.statusSynced': 'Synced',
  'cloud.statusPending': 'Pending',
  'cloud.statusError': 'Sync error',
  'cloud.statusOffline': 'Offline — will sync when the network returns',
  'cloud.statusSignedOut': 'Signed out',
  'cloud.statusUnconfigured': 'Cloud not configured',
  'cloud.syncNow': 'Sync now',
  'cloud.unconfiguredHint':
    'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (free plan). The DeepL key stays on the translation server.',
  'cloud.signedInAs': 'Signed in: {{email}}',
  'cloud.errorInvalid': 'Incorrect email or password.',
  'cloud.errorTaken': 'An account already exists for this email.',
  'cloud.errorWeak': 'Password too short (6 characters minimum).',
  'cloud.errorConfirmEmail': 'Confirm your email, then sign in again.',
  'cloud.errorOffline': 'Network unavailable.',
  'cloud.errorRejected': 'The request was rejected.',
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
    'Play chess on the board or by voice.',
  'modes.openings.title': 'Learn your openings',
  'modes.openings.description':
    'Learn your openings and practice replaying them.',
  'modes.blind.title': 'Memorization',
  'modes.blind.description':
    'Remember move sequences by listening or watching.',
  'modes.puzzles.title': 'Tactical training',
  'modes.puzzles.description': 'Solve problems and train your endgames.',
  'modes.visualisation.title': 'Board vision',
  'modes.visualisation.description':
    'Follow moves mentally and spot them on the board.',
  'modes.quiz-ouverture.title': 'General knowledge',
  'modes.quiz-ouverture.description':
    'Recognize openings and test your knowledge.',
  'modes.parties.title': 'Game analyses',
  'modes.parties.description':
    'Organize your games, replay them and analyze the positions that interest you.',
  'parties.title': 'Game analyses',
  'parties.subtitle':
    'Organize your games, replay them and analyze the positions that interest you.',
  'parties.importPgn': 'Import a PGN / FEN',
  'parties.importPgnFen': 'Import a PGN / FEN',
  'parties.startFromInitial': 'Analyze from the starting position',
  'parties.createFolderFab': 'Folder',
  'parties.createFolderA11y': 'Create a folder',
  'parties.unfiledFolder': 'Unsorted',
  'parties.systemFolder': 'System folder',
  'parties.importFilePgn': 'Import a PGN file',
  'parties.pastePgn': 'Paste a PGN',
  'parties.pastePgnPlaceholder': 'Paste a PGN here…',
  'parties.pasteFen': 'Paste a FEN',
  'parties.pasteFenPlaceholder': 'Paste a FEN position here…',
  'parties.pgnInvalid': 'Invalid or incomplete PGN.',
  'parties.fenInvalid': 'Invalid FEN. Check the position you entered.',
  'parties.saveAnalysis': 'Save',
  'parties.savedToUnfiled': 'Saved to “Unsorted”.',
  'parties.alreadySaved': 'This analysis is already saved.',
  'parties.importTitle': 'Import a PGN / FEN',
  'parties.emptyFolder': 'No analyses in this folder.',
  'parties.moveGame': 'Move to a folder',
  'parties.folderLocked': 'System folder — cannot be deleted',
  'parties.anyliseurProfileFastDesc':
    'Near-instant analysis for navigating through the game quickly.',
  'parties.anyliseurProfileNormalDesc':
    'More precise analysis, with a moderate wait.',
  'parties.anyliseurProfileDeepDesc':
    'Deeper analysis, slower.',
  'parties.anyliseurProfileMetric': '~{{ms}} ms · depth {{depth}}',
  'parties.empty':
    'No saved analyses yet. Import a PGN or start from the initial position, then save.',
  'parties.noMeta': 'No metadata available',
  'parties.moveCount': '{{count}} plies',
  'parties.importOk': '{{count}} game(s) imported',
  'parties.importProgress': 'Import {{done}} / {{total}}',
  'parties.importRenameOffer': 'File “{{file}}” imported.\nRename?',
  'parties.multiSelectTitle': 'Select up to 10 PGN files to import.',
  'parties.multiSelectCount': '{{selected}} / {{max}} selected',
  'parties.gameSelectTitle': 'Select up to {{count}} games to import.',
  'parties.gameSelectFound': '{{count}} games found',
  'parties.gameSelectSearch': 'Search (player, event, date…)',
  'parties.gameSelectMax': 'Maximum 10 games per import.',
  'parties.gameSelectEmpty': 'No matching games.',
  'parties.gameSelectIndexed': 'Indexed {{count}} games in {{ms}} ms',
  'parties.importSelectedCount': 'Import {{count}} games',
  'parties.newFolder': 'New folder',
  'parties.folderDeleteTitle': 'Delete folder?',
  'parties.folderDeleteConfirm':
    'This folder contains {{games}} game(s) and {{folders}} subfolder(s).',
  'parties.folderDeleteAll': 'Delete folder and its contents',
  'parties.importDuplicates': '{{count}} already present',
  'parties.importSkipped': '{{count}} skipped',
  'parties.importNone': 'No new games imported',
  'parties.importFailed': 'PGN import failed',
  'parties.deleteTitle': 'Delete this game?',
  'parties.deleteConfirm': 'Delete',
  'parties.voiceCommands': 'Voice commands',
  'parties.nameRequired': 'Name cannot be empty.',
  'parties.importCancelled': 'Import cancelled',
  'parties.importAction': 'Import',
  'parties.gameNamePlaceholder': 'e.g. Morphy – Duke of Brunswick',
  'parties.gameName': 'Game name',
  'parties.deleteConfirmMessage': 'Delete this game?',
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
  'parties.flipBoard': 'Flip board',
  'parties.anyliseurTabGame': 'Game',
  'parties.anyliseurTabAnalysis': 'Analysis',
  'parties.anyliseurProfileFast': 'Fast',
  'parties.anyliseurProfileNormal': 'Medium',
  'parties.anyliseurProfileDeep': 'Strong',
  'parties.anyliseurExport': 'Export',
  'parties.anyliseurExportDone': 'Enriched PGN copied.',
  'parties.anyliseurExportFail': 'Could not copy PGN.',
  'parties.anyliseurOpenReader': 'Reader',
  'parties.anyliseurArrowsOn': 'Arrow on',
  'parties.anyliseurArrowsOff': 'Arrow off',
  'parties.anyliseurUnavailable': 'The analysis engine is unavailable.',
  'parties.anyliseurRetry': 'Retry',
  'parties.anyliseurInitializing': 'Starting engine…',
  'parties.anyliseurAnalyzing': 'Analyzing…',
  'parties.anyliseurReady': 'Engine ready',
  'parties.anyliseurProgress': 'Analysis {{done}} / {{total}}',
  'parties.anyliseurProgressMain': 'Main line analysis {{done}} / {{total}}',
  'parties.anyliseurProgressVariants': 'Variants analysis {{done}} / {{total}}',
  'parties.anyliseurPlayed': 'Played',
  'parties.anyliseurBest': 'Best',
  'parties.anyliseurBefore': 'Before',
  'parties.anyliseurAfter': 'After',
  'parties.anyliseurBestMoves': 'Best moves',
  'parties.anyliseurWaiting': 'Waiting for lines…',
  'parties.anyliseurMore': 'More details',
  'parties.anyliseurLess': 'Less',
  'parties.anyliseurCurve': 'Evaluation curve',
  'parties.anyliseurAnalyzed': 'Analyzed',
  'parties.anyliseurReanalyze': 'Re-analyze',
  'parties.anyliseurExportIncludeEvals': 'Include evaluations',
  'parties.anyliseurExportCopyPgn': 'Copy PGN',
  'parties.anyliseurExportDownloadPgn': 'Download PGN',
  'parties.anyliseurExportCopyFen': 'Copy FEN',
  'parties.anyliseurExportDownloadFen': 'Download FEN',
  'parties.anyliseurImportFile': 'Import a PGN file',
  'parties.anyliseurImportPaste': 'Paste a PGN or FEN',
  'parties.anyliseurImportLibrary': 'Choose from library',
  'parties.anyliseurImportInvalid': 'Invalid import — current game kept.',
  'parties.anyliseurMultiGameChoice': 'Multiple games found — pick one.',
  'parties.anyliseurFenLoaded': 'FEN position loaded.',
  'parties.anyliseurA11yFlip': 'Flip board',
  'parties.anyliseurA11yFlipHint': 'Swap white and black board orientation',
  'parties.anyliseurA11yArrowsHint': 'Show or hide the best-move arrow',
  'parties.anyliseurA11yProfile': 'Analysis profile',
  'parties.anyliseurA11yProfileHint': 'Choose engine search time',
  'parties.anyliseurA11yImport': 'Import PGN',
  'parties.anyliseurA11yImportHint': 'Load a new game from PGN',
  'parties.anyliseurA11yExportHint': 'Copy enriched PGN to the clipboard',
  'parties.anyliseurA11yOpenReaderHint': 'Open the same position in the Reader',
  'parties.anyliseurA11yReturn': 'Return to exploration origin',
  'parties.anyliseurA11yReturnHint': 'Go back to the position before exploration moves',
  'parties.anyliseurProfileTitle': 'Analysis profile',
  'parties.anyliseurProfileHint':
    'These modes set engine search time and maximum depth, not difficulty.',
  'parties.anyliseurProfileClose': 'Close analysis profile',
  'parties.analyzer': 'AnyLyseur',
  'parties.analyzerSubtitle': 'Game and position analysis',
  'parties.analyzerEmpty': 'Paste a PGN to start AnyLyseur.',
  'parties.analyzerPaste': 'Paste a PGN here…',
  'parties.analyzerLoad': 'Load',
  'parties.parseError': 'Unable to read this game.',
  'parties.parseErrorHint': 'Check the PGN (moves, headers) and try again.',
  'parties.openAnalyzer': 'Open AnyLyseur',
  'parties.openWorkspace': 'Analyze from the starting position',
  'parties.workspace': 'Game analysis',
  'parties.workspaceSubtitle': 'Game and analysis — one shared state',
  'game.movesPlayed': 'Moves played',
  'game.exportPgn': 'Export PGN',
  'game.export': 'Export',
  'game.yourTurn': 'Your move.',
  'game.opponentThinking': 'Opponent is thinking…',
  'game.opponentPreparing': 'Opponent is preparing a move…',
  'game.opponentFailed': 'The engine could not play this move.',
  'game.opponentRetry': 'Retry',
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
  'errors.systemFolderProtected': 'This system folder cannot be changed.',
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
  'openings.moveOr': ' or ',
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
    'Listen to moves, then replay them in the right order.',
  'blind.watchRecite': 'Watch then recite',
  'blind.watchReciteDesc':
    'Watch moves, then recite them out loud.',
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
    'Practice following moves and visualizing positions.',
  'vision.mental': 'Mental position tracking',
  'vision.mentalDesc':
    'Follow the moves in your head, then find the position.',
  'vision.nommer': 'Name the move',
  'vision.nommerDesc': 'Watch a move and give its name.',
  'vision.jouer': 'Play the move',
  'vision.jouerDesc': 'Read a move and play it on the board.',
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
    'Discover openings and test your chess knowledge.',
  'quiz.quiz': 'Quiz',
  'quiz.culture': 'Chess culture',
  'quiz.cultureDesc':
    'Answer questions about the world of chess.',
  'quiz.cultureMixed': 'Chess culture — 10 mixed questions',
  'quiz.quelle': 'Which opening?',
  'quiz.quelleDesc': 'Guess the opening from the moves played.',
  'quiz.defendsNulle': 'Defend the draw!',
  'quiz.defendsNullePageTitle': 'Endgame Training',
  'quiz.defendsNulleDesc':
    'Hold an equal position against Stockfish.',
  'quiz.defendsNulleLead':
    'Pick a new endgame or replay a position from Try again!',
  'quiz.defendsNulleProgress': 'Moves played: {{current}}',
  'quiz.defendsNulleThinking': 'Stockfish is analyzing…',
  'quiz.defendsNullePreparing': 'Preparing Stockfish…',
  'quiz.defendsNulleReflecting': 'Stockfish is thinking…',
  'quiz.defendsNulleLoading': 'Loading…',
  'quiz.defendsNulleAgain': 'New position',
  'quiz.defendsNulleNext': 'Next position',
  'quiz.defendsNulleContinue': 'Continue',
  'quiz.defendsNulleRestart': 'Restart',
  'quiz.defendsNulleAnother': 'Play another endgame',
  'quiz.defendsNulleEngineUnavailable':
    'Stockfish is not available in this version of the app.',
  'quiz.stockfishPreparing': 'Preparing Stockfish…',
  'quiz.stockfishWebError': 'Stockfish could not start in this browser.',
  'quiz.stockfishNativeUnavailable':
    'Stockfish is not yet available on this mobile platform.',
  'quiz.stockfishRetry': 'Retry',
  'quiz.stockfishBack': 'Back',
  'quiz.positionNotFound': 'This position could not be found.',
  'quiz.stockfishDevDetail':
    'Status: {{status}}\nError: {{error}}\nWorker: {{worker}}',
  'quiz.endgameNewFinales': 'New Endgames!',
  'quiz.endgameNewFinalesDesc':
    'A random varied position you have never finished.',
  'quiz.endgameTryAgain': 'Try again!',
  'quiz.endgameTryAgainDesc':
    'Replay a position you chose to add after an attempt.',
  'quiz.endgameTryAgainEmpty':
    'No positions yet. You can add some after a lost attempt.',
  'quiz.endgamePoolExhausted':
    'You have finished every available new position. Come back later or open Try again!',
  'quiz.endgamePoolPreparing':
    'New endgames are being prepared.',
  'quiz.endgameMovesResisted': 'Moves resisted: {{count}}',
  'quiz.endgameHideGauge': 'Hide gauge',
  'quiz.endgameShowGauge': 'Show gauge',
  'quiz.endgameOffScore': 'Off-score continuation',
  'quiz.endgameVerifying': 'Verifying…',
  'quiz.endgameThisAttempt': 'This attempt: {{count}} moves',
  'quiz.endgamePrevAttempt': 'Previous attempt: {{count}} moves',
  'quiz.endgameBestAttempt': 'Best attempt: {{count}} moves',
  'quiz.endgameAnalyse': 'Analyse!',
  'quiz.analyseGame': 'Analyse game',
  'quiz.analysePosition': 'Analyse position',
  'quiz.endgameAddTryAgain': 'Add to Try again',
  'quiz.endgameAddedTryAgain': 'Added to Try again',
  'quiz.endgameRetry': 'Retry',
  'quiz.endgameContinuePosition': 'Continue the position',
  'quiz.endgameContinueOffScore': 'Continue off score',
  'quiz.endgameRemoveTryAgain': 'Remove from Try again',
  'quiz.endgameBackMenu': 'Back to menu',
  'quiz.endgameObjectiveWin': 'Objective: win this endgame',
  'quiz.endgameObjectiveDraw': 'Objective: save the draw',
  'quiz.endgameOfferDraw': 'Offer draw',
  'quiz.endgameCopyFen': 'Copy FEN',
  'quiz.endgameFenCopied': 'FEN copied!',
  'quiz.endgameReplay': 'Replay endgame',
  'quiz.theoreticalEndgameTitle': 'Theoretical Endgames',
  'quiz.theoreticalEndgameDesc':
    'Pick an endgame and practice playing it.',
  'quiz.theoreticalEndgameLead': 'Practice essential endgames through repetition.',
  'quiz.theoreticalRandom': 'Random',
  'quiz.theoreticalViewList': 'List',
  'quiz.theoreticalViewCards': 'Cards',
  'quiz.theoreticalAllMastered': 'All themes mastered — random position from the pool.',
  'quiz.theoreticalNoAttempts': '—/10',
  'quiz.theoreticalCompleted': 'Completed',
  'quiz.theoreticalObjectiveWin': 'Win the position',
  'quiz.theoreticalObjectiveDraw': 'Obtain the draw',
  'quiz.theoreticalMovesPlayed': 'Moves played: {{count}} / target {{target}}',
  'quiz.theoreticalOffScore': 'Off-score continuation',
  'quiz.theoreticalVerifying': 'Verifying…',
  'quiz.theoreticalAnalyse': 'Analyse',
  'quiz.theoreticalRetry': 'Retry',
  'quiz.theoreticalNext': 'Next',
  'quiz.theoreticalContinueOffScore': 'Continue off score',
  'quiz.theoreticalBackThemes': 'Back to themes',
  'quiz.theoreticalExitTitle': 'Leave this endgame?',
  'quiz.theoreticalExitBody':
    'This attempt will be abandoned and will not affect your score.',
  'quiz.theoreticalExitContinue': 'Continue the endgame',
  'quiz.theoreticalExitConfirm': 'Leave',
  'quiz.theoreticalScoreOld': 'Previous score: {{score}}',
  'quiz.theoreticalScoreNew': 'New score: {{score}}',
  'quiz.theoreticalScoreAttempts': '{{count}} scored attempt(s)',
  'quiz.theoreticalThemeQueenMate': 'Queen and king vs king',
  'quiz.theoreticalThemeRookMate': 'Rook and king vs king',
  'quiz.theoreticalThemeTwoBishopsMate': 'Two bishops vs king',
  'quiz.theoreticalThemePawnSquare': 'Pawn square',
  'quiz.theoreticalThemeOpposition': 'Opposition',
  'quiz.theoreticalThemeKpVsK': 'King and pawn vs king',
  'quiz.theoreticalThemePawnRace': 'Pawn race',
  'quiz.theoreticalThemePawnBreakthrough': 'Pawn breakthrough',
  'quiz.theoreticalThemeThreePawns': 'Three pawns vs three pawns',
  'quiz.theoreticalThemeLucena': 'Lucena position',
  'quiz.theoreticalThemePhilidor': 'Philidor position',
  'quiz.theoreticalExplainLink': 'Endgame explanation',
  'quiz.theoreticalExplainPrinciple': 'Principle',
  'quiz.theoreticalExplainSeek': 'What to look for',
  'quiz.theoreticalExplainMethod': 'Method',
  'quiz.theoreticalExplainAvoid': 'Mistake to avoid',
  'quiz.theoreticalExplainPlay': 'Play this endgame',
  'quiz.theoreticalExplainClose': 'Close',
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
  'quiz.pickLevel': 'Choose your level',
  'quiz.notEnoughLines':
    'Not enough openings for this level ({{available}} / {{needed}}). Pick another level.',
  'quiz.reviewQuestions': 'Review questions',
  'quiz.changeLevel': 'Change level',
  'quiz.seeRecords': 'See records',
  'quiz.replaySameLevel': 'Replay this level',
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
  'records.cat.openingQuiz': 'Which opening',
  'records.cat.tacticsDesc': 'Best puzzle streaks by difficulty band',
  'records.cat.namingDesc': 'Best 60-second score (Board vision)',
  'records.cat.playDesc': 'Best 60-second score (Board vision)',
  'records.cat.blindDesc':
    'Best number of full moves at 100% with no help and no errors',
  'records.cat.openingQuizDesc':
    'Best score out of 10 questions, by difficulty level',
  'records.subtitle': 'Your best scores already saved on this device',
  'records.best60': 'Best score / 60 s',
  'records.bestOutOfTen': 'Best score / 10',
  'records.resetTactics': 'Reset tactics records',
  'records.emptyTactics':
    'No records yet — solve puzzles to save some.',
  'records.emptyOpeningQuiz':
    'No records yet — play Which opening? to save some.',
  'records.blindResetBody':
    'This will reset the Listen then reconstruct and Watch then recite records.',
  'records.tacticsResetBody':
    'This will clear all saved best streaks.',
  'records.openingQuizResetBody':
    'This will reset Which opening? best scores for every level.',
  'records.sessionResetTitle': 'Reset this record?',
  'records.sessionResetBody':
    'This will reset the best 60-second score for {{label}}.',
  'records.blindHint':
    'Best full-move count at 100%, with no hints or mistakes.',
  'records.openingQuizHint': 'Best score out of 10 questions, by level.',
  'records.puzzleSubtitle': 'Best streaks by difficulty band',
  'records.visionSubtitle': 'Best 60-second scores — Board vision',
  'records.visionResetTitle': 'Reset all records?',
  'records.visionResetBody':
    'This will reset the 60-second records. Older delay-based (legacy) scores stay stored separately.',
  'records.legacyNote':
    'Older delay-based records are still present in storage (legacy).',
  'openings.emptyTitle': 'You don’t have a repertoire yet',
  'openings.emptyBody':
    'Create a folder first, then import a PGN opening to practice.',
  'openings.emptyLead':
    'Start by creating an openings folder. You can import a PGN file into it afterward.',
  'openings.emptySources':
    'PGNs come from your chess software, a game database, a repertoire you prepared, or a service that exports to PGN.',
  'openings.emptyPurpose':
    'AnyChess will use the variations in your file so you can replay and memorize them.',
  'openings.createFolder': 'Create a folder',
  'openings.pickFolderTitle': 'Choose an openings folder',
  'openings.pickFolderHint':
    'Every PGN must go into an existing folder. Create one if needed — no automatic “Unclassified” folder is created.',
  'openings.pickFolderEmpty':
    'No folders yet. Create a folder before importing.',
  'openings.renameDisplayName': 'Rename',
  'openings.renameDisplayPlaceholder': 'Display name in AnyChess',
  'openings.moveToFolder': 'Move',
  'openings.addToOpeningsFolder': 'Add to an openings folder',
  'openings.addToOpeningsDone': 'Game added to repertoire “{{name}}”.',
  'openings.addToOpeningsFail': 'Unable to add the game to the repertoire.',
  'openings.noPgnInGame': 'No PGN available for this game.',
  'openings.importNeedsFolder':
    'Choose or create a folder before importing a PGN.',
  'openings.linesCount': '{{count}} line(s)',
  'openings.sectionWhite': 'WHITE REPERTOIRE',
  'openings.sectionBlack': 'BLACK REPERTOIRE',
  'openings.sectionUnassigned': 'TO SORT',
  'openings.sectionUnassignedHint':
    'Folders without a side (data kept). Choose White or Black to include them in Review.',
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
  'openings.emptyPgnBody':
    'Import one or more .pgn files into this folder.',
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
    'Train your memory by remembering move sequences by ear or by eye.',
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
    'Solve problems, train your endgames and learn to defend a position.',
  'puzzle.mode': 'Mode',
  'puzzle.visual': 'Visual',
  'puzzle.blind': 'Blindfold',
  'puzzle.difficulty': 'Difficulty',
  'puzzle.visualCardTitle': 'Visual problems',
  'puzzle.visualCardDesc': 'Find the solution directly on the board.',
  'puzzle.blindCardTitle': 'Blindfold problems',
  'puzzle.blindCardDesc': 'Find the solution without seeing the full position.',
  'puzzle.difficultyDefaultHint':
    'You can change the default difficulty in Settings.',
  'settings.problemDifficulty': 'PROBLEM DIFFICULTY',
  'settings.visualProblemDifficulty': 'Visual problem difficulty',
  'settings.blindProblemDifficulty': 'Blind problem difficulty',
  'settings.engineStrength': 'ENGINE STRENGTH',
  'settings.stockfishStrength': 'Stockfish opponent level',
  'settings.stockfishStrengthHint':
    'Used in Classic play and when you leave the repertoire in Openings training.',
  'settings.translation': 'Translation',
  'settings.translateExistingPgn':
    'Translate comments in previously imported PGNs',
  'settings.translateImportedPgn': 'Translate comments when importing PGNs',
  'settings.translationNone': 'No comments to translate.',
  'settings.translationProgress':
    'Translation in progress: {{done}} / {{total}} comments.',
  'settings.translationProgressHint':
    '{{done}} comments already translated out of {{total}} English comments to process (variations included). Pending or failed comments are not counted as translated.',
  'settings.translationPaused': 'Translation paused',
  'settings.translationComplete': 'Translation complete',
  'settings.translationRetry': 'Retry',
  'settings.translationDiagTitle': 'Translation diagnostic (copy this)',
  'settings.translationDiagCopy': 'Copy diagnostic',
  'settings.translationDiagCopied': 'Diagnostic copied',
  'settings.translationTimeout':
    'The translation request timed out.',
  'settings.translationRateLimited':
    'The service is temporarily rate-limiting requests. Already translated comments are kept. Try again shortly.',
  'settings.translationCounts':
    '{{done}} translated · {{pending}} pending · {{failed}} failed',
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
  'activity.resumeTitle': 'Activities in progress',
  'activity.resumeCta': 'Resume',
  'activity.discardPartieTitle': 'Leave this game?',
  'activity.discardPartieBody':
    'You will lose your current game. Do you really want to quit?',
  'activity.discardPartieConfirm': 'Quit game',
  'activity.discardProblemeTitle': 'Leave this puzzle?',
  'activity.discardProblemeBody':
    'You will lose your current puzzle. Do you really want to quit?',
  'activity.discardProblemeConfirm': 'Quit puzzle',
  'activity.discardQuizTitle': 'Leave this quiz?',
  'activity.discardQuizBody':
    'You will lose your current quiz. Do you really want to quit?',
  'activity.discardQuizConfirm': 'Quit quiz',
  'activity.discardCoursTitle': 'Leave this lesson?',
  'activity.discardCoursBody':
    'You will lose your current lesson. Do you really want to quit?',
  'activity.discardCoursConfirm': 'Quit lesson',
  'activity.discardExerciceTitle': 'Leave this exercise?',
  'activity.discardExerciceBody':
    'You will lose your current exercise. Do you really want to quit?',
  'activity.discardExerciceConfirm': 'Quit exercise',
  'activity.quitCta': 'Quit',
  'activity.endPartieTitle': 'Leave this game?',
  'activity.endPartieBody': 'The current game can no longer be resumed.',
  'activity.endExerciceTitle': 'Leave this exercise?',
  'activity.endExerciceBody': 'Your current progress will be lost.',
  'activity.endAnalyseTitle': 'Leave this analysis?',
  'activity.endAnalyseBody': 'The current analysis can no longer be resumed.',
  'activity.endQuizTitle': 'Leave this quiz?',
  'activity.endQuizBody': 'Your current progress will be lost.',
  'activity.endTrainingTitle': 'Leave this training?',
  'activity.endTrainingBody': 'Your current progress will be lost.',
  'activity.continueGame': 'Continue',
  'activity.continueExercise': 'Continue the exercise',
  'activity.continueTraining': 'Continue training',
  'activity.abandonTitle': 'Resign this game?',
  'activity.abandonBody': 'The current game can no longer be resumed.',
  'activity.abandonConfirm': 'Resign',
  'activity.backPartieTitle': 'Quit the game?',
  'activity.backExerciceTitle': 'Abandon the exercise?',
  'activity.backExerciceConfirm': 'Abandon',
  'home.tagline': 'Play. Learn. Visualize.',
  'board.gameContinues': 'The game continues normally.',
  'board.show': 'Show board',
  'campPicker.title': 'Choose your side',
  'campPicker.randomSide': 'Random side',
  'campPicker.hint': 'Tap the white or black pieces, or choose a random side.',
  'exercise.referenceCopied': 'Reference copied',
  'exercise.tryAgainAlready': 'Already in “Try again!”',
  'exercise.tryAgainAddTitle': 'Add this position to “Try again!”?',
  'review.bestMove': 'Best move: {{san}}',
  'review.returnToPosition': 'Back to the position',
  'review.finishGameTitle': 'Finish the game?',
  'review.finishGameBody': 'Your exercise result will stay the same.',
  'review.backToResult': 'Back to the result',
  'review.finishGame': 'Finish game',
  'puzzle.bandRandomAll': 'Random / All',
  'profil.eloUnrated': 'Unrated',
  'openings.noPlayableLine': 'No playable line in this repertoire.',
  'vision.answerRecorded': 'Answer recorded',
  'vision.insufficientQuestions': 'Not enough reliable questions.',
  'endgame.drawStalemate': 'Draw by stalemate. Well done!',
  'endgame.drawThreefold': 'Draw by repetition. Well done!',
  'endgame.drawInsufficient': 'Draw by insufficient material. Well done!',
  'endgame.drawFifty': 'Draw under the fifty-move rule. Well done!',
  'endgame.drawDefended': 'Draw — position defended',
  'endgame.drawGeneric': 'Draw achieved. Well done!',
  'endgame.defendedThirty': 'Endgame defended! You held on for 30 moves.',
  'endgame.checkmateWin': 'Checkmate. You won!',
  'endgame.checkmateLoss': 'Checkmate. You lost.',
  'endgame.positionWon': 'Winning position!',
  'endgame.drawAchieved': 'Draw achieved!',
  'endgame.illegalMove': 'Illegal move.',
  'endgame.heldMoves': 'You held on for {{count}} moves',
  'endgame.evalChanged': 'The evaluation changed from {{before}} to {{after}}.',
  'endgame.noReliableAlternative': 'No sufficiently reliable alternative could be confirmed.',
  'endgame.drawAltOne': 'The draw could have been maintained with {{san}}.',
  'endgame.drawAltTwo': 'The draw could have been maintained with {{first}} or {{second}}.',
  'endgame.drawAltThree': 'The draw could have been maintained with {{first}}, {{second}} or {{third}}.',
  'endgame.drawAltThreeMore':
    'Moves that kept the draw include {{first}}, {{second}} and {{third}}. Other moves also kept the balance.',
  'endgame.noMajorMistake':
    'No major mistake. The position gradually deteriorated.',
  'endgame.firstTurn': 'First turning point: {{move}}.{{san}}',
  'endgame.stockfishUnavailable': 'Stockfish is unavailable.',
  'endgame.engineError': 'Engine error.',
  'endgame.moveNotRecognized': 'Move not recognized.',
  'endgame.drawDefendedShort': 'Draw! Endgame defended.',
  'endgame.mateDefended': 'Mate! Endgame defended.',
  'theoretical.lostOnMove': 'The theoretical outcome was lost on move {{count}}.',
  'theoretical.gameOver': 'Game over.',
  'theoretical.drawObtained': 'Draw achieved.',
  'errors.illegalSan': 'Illegal move “{{san}}”.',
  'errors.invalidStartFen': 'Invalid starting FEN.',
  'errors.malformedPgn': 'Malformed PGN.',
  'errors.noGamesFound': 'No games found.',
  'openings.leftRepertoire': 'Left the repertoire with {{move}}',
  'openings.endOfTheory': 'End of the imported theoretical line after {{move}}',
  'position.refPrefix': 'Ref.',
  'quiz.defendsNulleDefendNext': 'Defend the next endgame',
  'pgn.commentOriginal': 'Original',
  'pgn.commentFrench': 'French',
  'pgn.translateComments': 'Translate comments into French',
  'pgn.completeTranslation': 'Complete the translation',
  'pgn.retryTranslation': 'Retry translation',
  'pgn.translateSelection': 'Translate selection',
  'pgn.translateAllExisting': 'Translate all existing PGNs',
  'pgn.translating': 'Translation in progress',
  'pgn.translationPending': 'Pending',
  'pgn.translationPartial': 'Partial translation',
  'pgn.translationUnavailable': 'Translation unavailable',
  'pgn.translationQueued': 'Translation queued',
  'pgn.serviceNotConfigured':
    'Automatic translation is not configured: the DeepL server is unreachable or the server key is missing. Originals stay on screen.',
  'pgn.translationQuota':
    'Monthly DeepL Free quota reached (500,000 characters per month). Already translated comments are kept. The rest stay queued, with the original shown.',
  'pgn.translationQuotaResume': 'The provider says it will resume in {{delay}}.',
  'pgn.translationUsage': 'DeepL usage: {{used}} / {{limit}} characters this month.',
  'pgn.translationFailed':
    'Translation failed. Original comments are kept.',
  'pgn.importNotice': 'English comments will be sent to the translation service to prepare a French version. You can use the import immediately.',
  'pgn.batchProgress': '{{done}} / {{total}} comments',
  'pgn.exportOriginal': 'Export original',
  'pgn.exportFrench': 'Export with French comments',
  'pgn.exportBilingual': 'Export bilingual',
  'pgn.languageUnknown': 'Language unclear — original kept',
  'pgn.cancelBatch': 'Cancel translation',
  'pgn.resumeBatch': 'Resume translation',
  'pgn.offlineQueued': 'Offline — translation will resume when the service is available.',
  'pgn.catchupHint': 'Some imported PGNs do not have a French version of their comments yet.',
  'pgn.alreadyFrench': 'Comments are already in French.',
  'speech.micDenied': 'Microphone denied. You can allow access in Settings.',
  'speech.micUnavailable': 'Speech recognition is not available.',
  'speech.unavailableBrowser':
    'Speech recognition is not available in this browser. Use Chrome/Edge, or enter the move on the keyboard.',
  'speech.micDeniedBrowser': 'Microphone permission denied. Allow the mic in the browser.',
  'speech.micUnavailableDevice': 'Microphone unavailable on this device / browser.',
  'speech.micPermissionFailed': 'Could not request microphone permission.',
  'speech.startFailed': 'Could not start speech recognition.',
  'speech.unsupported': 'Speech recognition is not supported here.',
  'speech.micError': 'Microphone error: {{code}}',
  'speech.nothingRecognized': 'Nothing usable was recognized. Try again.',
  'vision.answerUnrecognized': 'Not recognized — try again (not counted).',
  'errors.folderParentMissing': 'Parent folder not found.',
  'errors.systemFolderDelete': 'This system folder cannot be deleted.',
  'game.exportOrAnalyze': 'Export or analyze…',
  'game.exportNo': 'No',
  'game.exportYes': 'Yes',
  'blind.reciteSequence': 'Recite the sequence aloud, move by move.',
  'puzzle.illegalHere': 'Illegal here ({{detail}}). Not counted as a move error.',
  'activity.openingTraining': 'Opening training',
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

