/**
 * Compatibility redirect: old Lecteur route → unified game workspace.
 * Preserves gameId / nodeId / flipped so deep links and adapters keep working.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function GameReaderRedirect() {
  const params = useLocalSearchParams<{
    gameId?: string;
    nodeId?: string;
    flipped?: string;
  }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : '';

  if (!gameId) {
    return <Redirect href="/parties" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/parties/analyzer',
        params: {
          gameId,
          ...(typeof params.nodeId === 'string' && params.nodeId
            ? { nodeId: params.nodeId }
            : {}),
          ...(params.flipped === '1' ? { flipped: '1' } : {}),
        },
      }}
    />
  );
}
