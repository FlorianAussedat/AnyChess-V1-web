import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { speechService } from '@/services/SpeechService';

/**
 * Cancel any ongoing / queued TTS when the calling screen unmounts or when
 * the route pathname changes away from `activePath` (if provided).
 *
 * Enforces: live user navigation always has priority over obsolete speech.
 */
export function useCancelSpeechOnLeave(activePath?: string): void {
  const pathname = usePathname();

  useEffect(() => {
    return () => {
      speechService.cancel('unmount');
    };
  }, []);

  useEffect(() => {
    if (!activePath) return;
    if (pathname !== activePath) {
      speechService.cancel('navigate');
    }
  }, [pathname, activePath]);
}
