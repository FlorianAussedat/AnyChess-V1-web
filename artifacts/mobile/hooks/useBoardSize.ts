import { useWindowDimensions } from 'react-native';
import {
  computeBoardSize,
  type BoardSizeMode,
} from '@/lib/game/boardSize';

/**
 * Reactive square board edge for the current window width.
 */
export function useBoardSize(mode: BoardSizeMode = 'default'): number {
  const { width } = useWindowDimensions();
  return computeBoardSize(width, mode);
}
