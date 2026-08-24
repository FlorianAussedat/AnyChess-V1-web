/**
 * Universal chess workspace — single component shared by page reader, analysis overlay,
 * finish-game overlay, and future mode wrappers.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessMoveInput } from '@/components/game/ChessMoveInput';
import { ChessMoveKeypad } from '@/components/game/ChessMoveKeypad';
import { ChessKeyboardToggle } from '@/components/game/ChessKeyboardToggle';
import { GamePlaybackControls } from '@/components/gameLibrary/GamePlaybackControls';
import { GameReaderMoveList } from '@/components/gameLibrary/GameReaderMoveList';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useChessInputMode } from '@/hooks/useChessInputMode';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { useExerciseBoardTouch } from '@/hooks/useExerciseChessInput';
import { UniversalEvalGauge } from '@/lib/evaluation/UniversalEvalGauge';
import { useSharedStockfishRuntime } from '@/lib/engines/runtime';
import type { BoardPiece, LastMove } from '@/lib/game/types';
import { formatSanForDisplay } from '@/lib/chess/notation';
import type { ChessWorkspacePayload } from '@/lib/workspace/types';
import { useChessWorkspace, sideFromFen } from '@/lib/workspace/useChessWorkspace';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  payload: ChessWorkspacePayload;
  boardSize: number;
  showMoves?: boolean;
  setShowMoves?: (value: boolean) => void;
  showBoard?: boolean;
  setShowBoard?: (value: boolean) => void;
  /** Called when a game-over result is reached (finish-vs-engine). */
  onGameOver?: (result: string) => void;
};

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

function lastMoveFromSans(startFen: string, sans: string[]): LastMove | null {
  if (sans.length === 0) return null;
  let fen = startFen;
  try {
    const chess = new Chess(fen);
    for (let i = 0; i < sans.length - 1; i++) {
      chess.move(sans[i]!);
    }
    const before = chess.fen();
    const m = chess.move(sans[sans.length - 1]!);
    if (!m) return null;
    return { from: m.from, to: m.to };
  } catch {
    return null;
  }
}

export function UniversalChessWorkspace({
  payload,
  boardSize,
  showMoves = true,
  setShowMoves,
  showBoard = true,
  setShowBoard,
  onGameOver,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { engineReady, runtime } = useSharedStockfishRuntime();
  const { inputMode, toggleChessInputMode, keypadActive } = useChessInputMode();
  const [draftMove, setDraftMove] = useState('');

  const workspace = useChessWorkspace({
    payload,
    engine: runtime.getService(),
    engineReady,
  });

  const isFinishVsEngine = payload.workspaceMode === 'finish-vs-engine';
  const isInteractive =
    payload.workspaceMode === 'analysis' ||
    payload.workspaceMode === 'free-play' ||
    isFinishVsEngine;

  // Active FEN for display and input
  const displayFen = isFinishVsEngine
    ? workspace.finishState.fen
    : workspace.currentFen;

  // Board pieces
  const board = useMemo(() => boardFromFen(displayFen), [displayFen]);

  // Last move highlight
  const lastMove = useMemo(() => {
    if (isFinishVsEngine) {
      return lastMoveFromSans(payload.initialFen, [
        ...(payload.moves?.map((m) => m.san) ?? []),
      ]);
    }
    return workspace.lastMove;
  }, [isFinishVsEngine, payload.initialFen, payload.moves, workspace.lastMove]);

  // Eval for display (finish-vs-engine uses reader eval on its fen)
  const gauge = workspace.evalState.evaluation;

  // Side to move label
  const sideLabel = isFinishVsEngine
    ? sideFromFen(workspace.finishState.fen) === 'white'
      ? t('game.sideToMoveWhite')
      : t('game.sideToMoveBlack')
    : workspace.sideToMove === 'white'
      ? t('game.sideToMoveWhite')
      : t('game.sideToMoveBlack');

  // Engine is acting in finish-vs-engine mode
  const engineActing =
    isFinishVsEngine &&
    workspace.finishState.phase === 'playing' &&
    sideFromFen(workspace.finishState.fen) === payload.engineOpponent?.color;

  // Can the player move?
  const canAct =
    isFinishVsEngine
      ? workspace.finishState.phase === 'playing' &&
        !engineActing &&
        sideFromFen(workspace.finishState.fen) !== payload.engineOpponent?.color
      : isInteractive;

  // Board touch (analysis / free-play: modify main workspace; finish-vs-engine: play finish move)
  const { touchSelected, legalDests, onSquarePress } = useExerciseBoardTouch({
    canAct,
    getLegalDestinations: (from) => {
      if (isFinishVsEngine) return workspace.finishLegalDests(from);
      return workspace.legalDestinations(from);
    },
    onMove: (from, to, promo) => {
      if (isFinishVsEngine) {
        workspace.playFinishMove(from, to, promo);
      } else {
        workspace.playMove(from, to, promo);
      }
    },
    onSan: (san) => {
      if (isFinishVsEngine) {
        workspace.playFinishSan(san);
      } else {
        workspace.playSan(san);
      }
    },
  });

  const bestLabel = useMemo(() => {
    if (!workspace.evalState.bestSan) {
      return workspace.evalState.thinking ? '…' : '—';
    }
    return formatSanForDisplay(workspace.evalState.bestSan, chessNotation);
  }, [chessNotation, workspace.evalState.bestSan, workspace.evalState.thinking]);

  // Notify parent when game ends
  const prevPhase = React.useRef(workspace.finishState.phase);
  React.useEffect(() => {
    if (
      isFinishVsEngine &&
      prevPhase.current !== 'game-over' &&
      workspace.finishState.phase === 'game-over' &&
      workspace.finishState.result
    ) {
      onGameOver?.(workspace.finishState.result);
    }
    prevPhase.current = workspace.finishState.phase;
  }, [isFinishVsEngine, workspace.finishState, onGameOver]);

  return (
    <View style={styles.root}>
      {/* Toggles row */}
      <View style={styles.toggles}>
        {setShowBoard ? (
          <Pressable
            onPress={() => setShowBoard(!showBoard)}
            style={[styles.toggleBtn, { borderColor: colors.border }]}
            testID="workspace-board-toggle"
          >
            <Text style={{ color: colors.foreground, fontSize: 12 }}>
              {showBoard ? 'Masquer l\u2019\u00e9chiquier' : 'Afficher l\u2019\u00e9chiquier'}
            </Text>
          </Pressable>
        ) : null}
        <BoardCoordinatesToggle
          visible={showCoordinates}
          onToggle={() => void toggleCoordinates()}
        />
        {setShowMoves ? (
          <Pressable
            onPress={() => setShowMoves(!showMoves)}
            style={[styles.toggleBtn, { borderColor: colors.border }]}
            testID="workspace-moves-toggle"
          >
            <Text style={{ color: colors.foreground, fontSize: 12 }}>
              {showMoves ? t('parties.hideMoves') : t('parties.showMoves')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Eval gauge */}
      {gauge && (
        <UniversalEvalGauge
          visible
          mode="analysis"
          scoreCp={gauge.type === 'cp' ? gauge.value : 0}
          mateIn={gauge.type === 'mate' ? gauge.value : null}
          perspective="white"
          scoreIsPerspectivePov
          testID="workspace-eval-gauge"
        />
      )}

      {/* Side to move */}
      <Text
        style={[styles.sideToMove, { color: colors.primary }]}
        testID="workspace-side-to-move"
      >
        {sideLabel}
      </Text>

      {/* Engine thinking indicator */}
      {(workspace.evalState.thinking || engineActing) && (
        <View style={styles.engineRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={{ color: colors.primary, fontSize: 12 }}>
            {engineActing ? 'Stockfish joue\u2026' : 'Stockfish r\u00e9fl\u00e9chit\u2026'}
          </Text>
        </View>
      )}

      {/* No engine warning */}
      {!engineReady && (
        <Text
          style={[styles.engineMissing, { color: colors.mutedForeground }]}
          testID="workspace-no-engine"
        >
          Stockfish indisponible
        </Text>
      )}

      {/* Game over banner */}
      {isFinishVsEngine && workspace.finishState.phase === 'game-over' && (
        <Text
          style={[styles.gameOverText, { color: colors.foreground }]}
          testID="workspace-game-over"
        >
          Partie terminée — {workspace.finishState.result ?? ''}
        </Text>
      )}

      {/* Board */}
      {showBoard && (
        <ChessBoardSection boardSize={boardSize}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={payload.orientation === 'black'}
            selectedSquare={isInteractive ? touchSelected : undefined}
            legalDots={isInteractive ? legalDests : undefined}
            onSquarePress={isInteractive ? onSquarePress : undefined}
            showCoordinates={showCoordinates}
            size={boardSize}
            sizeMode="wide"
          />
        </ChessBoardSection>
      )}

      {/* Navigation meta */}
      {!isFinishVsEngine && (
        <View style={styles.navMeta}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
            {workspace.currentPly}/{Math.max(workspace.pathMoves.length, workspace.mainMoves.length)}
          </Text>
          {workspace.evalState.bestSan && (
            <Text style={{ color: colors.primary, fontSize: 13 }}>
              Meilleur : {bestLabel}
            </Text>
          )}
        </View>
      )}

      {/* Navigation controls (reader/analysis modes only) */}
      {!isFinishVsEngine && (
        <GamePlaybackControls
          isPlaying={false}
          onStart={workspace.goStart}
          onPrev={workspace.goPrev}
          onTogglePlay={workspace.goNext}
          onNext={workspace.goNext}
          onEnd={workspace.goEnd}
          onRepeat={workspace.goPrev}
          labels={{
            start: t('parties.start'),
            prev: t('parties.prev'),
            play: t('parties.next'),
            pause: t('parties.next'),
            next: t('parties.next'),
            end: t('parties.end'),
            repeat: t('parties.prev'),
          }}
        />
      )}

      {/* Return to divergence + variant chips */}
      {!isFinishVsEngine && workspace.canReturnToBranch && (
        <Pressable
          onPress={workspace.returnToBranchRoot}
          style={[styles.returnBtn, { borderColor: colors.border }]}
          testID="workspace-return-branch"
        >
          <Text style={{ color: colors.foreground }}>Retour à la position</Text>
        </Pressable>
      )}
      {!isFinishVsEngine && workspace.variantChoices.length > 1 && (
        <View style={styles.variantRow} testID="workspace-variant-choices">
          {workspace.variantChoices.map((choice) => {
            const isSelected = choice.nodeId === workspace.selectedChildId;
            const label =
              choice.label === 'mainline'
                ? `Ligne principale : ${choice.san}`
                : choice.label === 'variant1'
                  ? `Variante 1 : ${choice.san}`
                  : choice.label === 'variant2'
                    ? `Variante 2 : ${choice.san}`
                    : `Variante : ${choice.san}`;
            return (
              <Pressable
                key={choice.nodeId}
                onPress={() => workspace.selectVariant(choice.nodeId)}
                testID={`workspace-variant-${choice.label}`}
                style={[
                  styles.variantChip,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : colors.card,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? '#fff' : colors.foreground,
                    fontSize: 12,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Interactive input (analysis / free-play) */}
      {isInteractive && canAct && !isFinishVsEngine && (
        <>
          <ChessKeyboardToggle
            variant="classic"
            active={keypadActive}
            onToggle={() => void toggleChessInputMode()}
            testID="workspace-keyboard-toggle"
          />
          {keypadActive ? (
            <ChessMoveKeypad
              fen={displayFen}
              value={draftMove}
              onChangeText={(text) => {
                setDraftMove(text);
              }}
              onSubmit={(san) => {
                setDraftMove('');
                workspace.playMove(
                  san.slice(0, 2) as string,
                  san.slice(2, 4) as string,
                );
              }}
              testID="workspace-keypad"
            />
          ) : (
            <ChessMoveInput
              inputType="chess-move"
              fen={displayFen}
              onSubmit={(raw) => {
                // SAN input for free analysis — try to find move
                try {
                  const chess = new Chess(displayFen);
                  const m = chess.move(raw);
                  if (m) workspace.playMove(m.from, m.to, m.promotion);
                } catch {
                  /* ignore invalid */
                }
              }}
              enabled
              autoSubmit
              testID="workspace-move-input"
            />
          )}
        </>
      )}

      {/* Finish-game interactive input */}
      {isFinishVsEngine && canAct && (
        <>
          <ChessKeyboardToggle
            variant="classic"
            active={keypadActive}
            onToggle={() => void toggleChessInputMode()}
            testID="workspace-finish-keyboard-toggle"
          />
          {keypadActive ? (
            <ChessMoveKeypad
              fen={displayFen}
              value={draftMove}
              onChangeText={setDraftMove}
              onSubmit={(san) => {
                setDraftMove('');
                workspace.playFinishSan(san);
              }}
              testID="finish-game-keypad"
            />
          ) : (
            <ChessMoveInput
              inputType="chess-move"
              fen={displayFen}
              onSubmit={(raw) => {
                try {
                  const chess = new Chess(displayFen);
                  const m = chess.move(raw);
                  if (m) workspace.playFinishMove(m.from, m.to, m.promotion);
                } catch {
                  /* ignore */
                }
              }}
              enabled
              autoSubmit
              testID="finish-game-move-input"
            />
          )}
        </>
      )}

      {/* Move list */}
      {showMoves && !isFinishVsEngine && (
        <GameReaderMoveList
          sans={workspace.pathMoves.map((m) => m.san)}
          currentPly={workspace.currentPly}
          onSelectPly={workspace.jumpToPly}
          testID="workspace-moves"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: DesignTokens.spacing.md,
  },
  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  toggleBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sideToMove: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navMeta: {
    alignItems: 'center',
    gap: 4,
  },
  returnBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  engineMissing: {
    textAlign: 'center',
    fontSize: 12,
  },
  gameOverText: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
