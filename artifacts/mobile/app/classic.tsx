import React from 'react';
import { GameProvider } from '@/contexts/GameContext';
import { ClassicGameScreen } from '@/components/ClassicGameScreen';

/**
 * Classic game mode route.
 *
 * The GameProvider is scoped to this route (not the whole app) so each mode
 * owns its own isolated logic and state, per the GameModes architecture.
 */
export default function ClassicRoute() {
  return (
    <GameProvider>
      <ClassicGameScreen />
    </GameProvider>
  );
}
