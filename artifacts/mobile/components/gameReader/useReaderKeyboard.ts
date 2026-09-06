/**
 * Web keyboard shortcuts for the shared game reader.
 * Skips when focus is in an editable field.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';

type Handlers = {
  onPrev: () => void;
  onNext: () => void;
  onStart: () => void;
  onEnd: () => void;
  enabled?: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = (el.tagName ?? '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || Boolean(el.isContentEditable);
}

export function useReaderKeyboard({
  onPrev,
  onNext,
  onStart,
  onEnd,
  enabled = true,
}: Handlers): void {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          onPrev();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onNext();
          break;
        case 'Home':
          event.preventDefault();
          onStart();
          break;
        case 'End':
          event.preventDefault();
          onEnd();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onPrev, onNext, onStart, onEnd]);
}
