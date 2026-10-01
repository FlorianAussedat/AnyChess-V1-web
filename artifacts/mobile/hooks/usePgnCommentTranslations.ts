import { useEffect, useState } from 'react';
import {
  pgnCommentTranslationStore,
  pgnTranslationQueue,
} from '@/lib/pgnComments';

export function usePgnCommentTranslations() {
  const [, bump] = useState(0);

  useEffect(() => {
    void pgnCommentTranslationStore.ensureLoaded();
    void pgnTranslationQueue.ensureLoaded();
    const unsubStore = pgnCommentTranslationStore.subscribe(() => bump((n) => n + 1));
    const unsubQueue = pgnTranslationQueue.subscribe(() => bump((n) => n + 1));
    return () => {
      unsubStore();
      unsubQueue();
    };
  }, []);

  return {
    store: pgnCommentTranslationStore,
    queue: pgnTranslationQueue,
  };
}
