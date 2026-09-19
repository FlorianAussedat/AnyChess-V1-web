/**
 * Drop the in-memory opening exercise as soon as play/continue is left.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { releaseEphemeralOpeningSessionIfLeaving } from '@/lib/repertoire';

export function useReleaseEphemeralOpeningSession() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const previous = previousPathname.current;
    previousPathname.current = pathname;
    releaseEphemeralOpeningSessionIfLeaving(previous, pathname);
  }, [pathname]);

  useEffect(() => {
    return () => {
      releaseEphemeralOpeningSessionIfLeaving(previousPathname.current, null);
    };
  }, []);
}
