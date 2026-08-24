/**
 * Direct workspace route — renders a registered ChessWorkspaceSession by ID.
 * Used for FEN import, position initiale, and any session opened without a game library entry.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { UniversalChessWorkspace } from '@/components/workspace/UniversalChessWorkspace';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import { getChessWorkspaceSession } from '@/lib/workspace/WorkspaceSessionRegistry';

const RESERVED_CHROME = 360;

export default function WorkspaceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [showBoard, setShowBoard] = useState(true);
  const [showMoves, setShowMoves] = useState(true);

  const session = useMemo(
    () => (sessionId ? getChessWorkspaceSession(String(sessionId)) : null),
    [sessionId],
  );

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      RESERVED_CHROME + contentTop + contentBottom,
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  if (!session) {
    return (
      <ChessScreenScaffold
        title={t('parties.reader')}
        onBack={() => router.back()}
        testID="workspace-session-missing"
      >
        <Text style={{ color: colors.foreground }}>Session introuvable.</Text>
        <Pressable onPress={() => router.replace('/parties' as Href)}>
          <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
        </Pressable>
      </ChessScreenScaffold>
    );
  }

  return (
    <ChessScreenScaffold
      title={session.payload.title}
      subtitle={session.payload.subtitle}
      onBack={() => router.back()}
      testID="workspace-screen"
    >
      <UniversalChessWorkspace
        payload={session.payload}
        boardSize={boardSize}
        showBoard={showBoard}
        setShowBoard={setShowBoard}
        showMoves={showMoves}
        setShowMoves={setShowMoves}
      />
    </ChessScreenScaffold>
  );
}
