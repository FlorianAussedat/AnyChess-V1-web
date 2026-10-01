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
    return pgnCommentTranslationStore.subscribe(() => bump((n) => n + 1));
  }, []);

  return {
    store: pgnCommentTranslationStore,
    queue: pgnTranslationQueue,
  };
}
