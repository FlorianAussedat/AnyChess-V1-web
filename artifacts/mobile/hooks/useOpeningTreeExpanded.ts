/**
 * Expand/collapse set for the openings tree, restored after a restart.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import {
  loadExpandedFolderIds,
  saveExpandedFolderIds,
} from '@/lib/repertoire/folderTreeExpanded';

if (
  Platform.OS === 'android' &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateTree(): void {
  try {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  } catch {
    /* LayoutAnimation is unavailable on some web hosts. */
  }
}

export function useOpeningTreeExpanded() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const hydrated = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = await loadExpandedFolderIds();
      if (cancelled) return;
      if (!dirty.current) setExpanded(new Set(ids));
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const write = useCallback((next: Set<string>) => {
    if (!hydrated.current && !dirty.current) return;
    void saveExpandedFolderIds([...next]);
  }, []);

  const toggle = useCallback((id: string) => {
    dirty.current = true;
    animateTree();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      write(next);
      return next;
    });
  }, [write]);

  const expand = useCallback((ids: readonly string[]) => {
    dirty.current = true;
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (changed) write(next);
      return next;
    });
  }, [write]);

  return { expanded, toggle, expand };
}
