import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { BackButton } from '@/components/BackButton';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { ChessBoard } from '@/components/ChessBoard';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useColors } from '@/hooks/useColors';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { replayLine, type ReplayLineHandle } from '@/lib/replay';
import {
  OpeningConstructionSession,
  openingFamilyNames,
  openingTargetsForFamily,
  pickRandomVariation,
  type OpeningTarget,
  type PlayerConstructionSnapshot,
} from '@/lib/openingQuiz';
import type { BoardPiece } from '@/contexts/GameContext';

function makeSession(target: OpeningTarget): OpeningConstructionSession {
  return new OpeningConstructionSession(target);
}

function Dropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '600' }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ color: colors.foreground }} numberOfLines={2}>
          {value}
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            maxHeight: 220,
            backgroundColor: colors.card,
          }}
        >
          <ScrollView nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                style={{
                  padding: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: opt === value ? colors.primary : colors.card,
                }}
              >
                <Text
                  style={{
                    color: opt === value ? colors.primaryForeground : colors.foreground,
                    fontSize: 13,
                  }}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function ConstruisOuvertureScreen() {
  const colors = useColors();
  const router = useRouter();
  useCancelSpeechOnLeave('/quiz-ouverture/construis');

  const families = useMemo(() => openingFamilyNames(), []);
  const [family, setFamily] = useState(families[0] ?? '');
  const variations = useMemo(() => openingTargetsForFamily(family), [family]);
  const [target, setTarget] = useState<OpeningTarget | null>(variations[0] ?? null);
  const [randomAnnouncement, setRandomAnnouncement] = useState<string | null>(null);
  const session = useRef(target ? makeSession(target) : null);
  const replayHandle = useRef<ReplayLineHandle | null>(null);
  const [snap, setSnap] = useState<PlayerConstructionSnapshot | null>(() =>
    session.current?.snapshotForPlayer() ?? null,
  );
  const [replayBoard, setReplayBoard] = useState<(BoardPiece | null)[][] | null>(null);
  const [replayLastMove, setReplayLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [touchSelected, setTouchSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      replayHandle.current?.cancel();
    };
  }, []);

  function clearTouch() {
    setTouchSelected(null);
    setLegalDests([]);
  }

  function resetSession(next: OpeningTarget | null) {
    setTarget(next);
    session.current = next ? makeSession(next) : null;
    setSnap(session.current?.snapshotForPlayer() ?? null);
    replayHandle.current?.cancel();
    setReplayBoard(null);
    setReplayLastMove(null);
    setIsReplaying(false);
    clearTouch();
  }

  function selectFamily(nextFamily: string) {
    setFamily(nextFamily);
    setRandomAnnouncement(null);
    const vars = openingTargetsForFamily(nextFamily);
    resetSession(vars[0] ?? null);
  }

  function selectVariation(name: string) {
    const next = variations.find((v) => v.identity.name === name) ?? null;
    setRandomAnnouncement(null);
    resetSession(next);
  }

  function pickRandom() {
    const pick = pickRandomVariation();
    if (!pick) return;
    setFamily(pick.family);
    const nextTarget = { identity: pick.line.identity, sans: pick.line.sans };
    setRandomAnnouncement(`Construis : ${pick.line.identity.name}`);
    resetSession(nextTarget);
  }

  function startReplay(line: string[]) {
    replayHandle.current?.cancel();
    setIsReplaying(true);
    clearTouch();
    replayHandle.current = replayLine({
      moves: line,
      intervalMs: 1000,
      onPosition: (fen) => {
        const game = new Chess(fen);
        setReplayBoard(game.board() as (BoardPiece | null)[][]);
      },
      onMove: (m) => {
        setReplayLastMove({ from: m.from, to: m.to });
      },
      onComplete: () => setIsReplaying(false),
    });
  }

  function applySnapshot(next: ReturnType<OpeningConstructionSession['answer']>) {
    setSnap(session.current?.snapshotForPlayer() ?? null);
    clearTouch();
    if (next.phase === 'wrong' || next.phase === 'complete') {
      startReplay(next.target.sans);
    }
  }

  function answer(raw: string) {
    if (!session.current) return;
    applySnapshot(session.current.answer(raw));
  }

  const canTouch = snap?.phase === 'playing' && !isReplaying;

  function onSquarePress(square: string) {
    if (!canTouch || !session.current) return;
    if (touchSelected === null) {
      const dests = session.current.getLegalDestinations(square);
      if (dests.length > 0) {
        setTouchSelected(square);
        setLegalDests(dests);
      }
    } else if (square === touchSelected) {
      clearTouch();
    } else if (legalDests.includes(square)) {
      applySnapshot(session.current.attemptMove({ from: touchSelected, to: square }));
    } else {
      const dests = session.current.getLegalDestinations(square);
      if (dests.length > 0) {
        setTouchSelected(square);
        setLegalDests(dests);
      } else {
        clearTouch();
      }
    }
  }

  const { micActive, toggleMic } = useSpeechInput({
    forceOff: snap?.phase !== 'playing' || isReplaying,
    isSpeaking: false,
    onTranscript: answer,
  });

  const boardToShow =
    replayBoard ??
    (session.current?.getBoard() as (BoardPiece | null)[][] | undefined) ??
    null;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 20,
        gap: 14,
        backgroundColor: colors.background,
      }}
    >
      <BackButton
        onPress={() => {
          replayHandle.current?.cancel();
          router.back();
        }}
      />
      <Text style={{ color: colors.foreground, fontSize: 25, fontWeight: '700' }}>
        Construis l’ouverture
      </Text>
      <Text style={{ color: colors.mutedForeground }}>
        Joue la ligne de référence exacte, coup par coup.
      </Text>

      <Dropdown label="Ouverture" value={family} options={families} onSelect={selectFamily} />
      {variations.length > 0 && target && (
        <Dropdown
          label="Variation"
          value={target.identity.name}
          options={variations.map((v) => v.identity.name)}
          onSelect={selectVariation}
        />
      )}

      <Pressable
        onPress={pickRandom}
        style={{
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.foreground, fontWeight: '600' }}>Aléatoire</Text>
      </Pressable>

      {!!randomAnnouncement && (
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{randomAnnouncement}</Text>
      )}

      {boardToShow && (
        <View style={{ alignItems: 'center' }}>
          <ChessBoard
            board={boardToShow}
            lastMove={replayLastMove}
            selectedSquare={canTouch ? touchSelected : null}
            legalDots={canTouch ? legalDests : []}
            onSquarePress={canTouch ? onSquarePress : () => {}}
          />
        </View>
      )}

      {snap && (
        <>
          <Text style={{ color: colors.mutedForeground }}>
            Joué : {snap.playedSans.join(' ') || '—'}
          </Text>
          {snap.phase === 'playing' ? (
            <>
              <ChessAnswerInput
                onSubmit={answer}
                enabled={!isReplaying}
                persistFocus
                placeholder="Dicte ou écris le coup"
              />
              <Pressable
                onPress={toggleMic}
                style={{
                  padding: 13,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.foreground }}>
                  {micActive ? 'Écoute…' : 'Répondre à voix haute'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: snap.phase === 'complete' ? '#398a55' : '#c44' }}>
              {snap.feedback}
            </Text>
          )}
          {isReplaying && (
            <Text style={{ color: colors.mutedForeground }}>Relecture de la ligne attendue…</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}
