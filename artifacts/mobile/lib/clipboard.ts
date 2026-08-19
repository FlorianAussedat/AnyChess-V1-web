/**
 * Cross-platform clipboard write.
 *
 * - Web: navigator.clipboard.writeText
 * - Native: expo-clipboard if available, otherwise navigator.clipboard fallback
 *
 * Returns true on success, false on failure or unavailability.
 */
import { Platform } from 'react-native';

export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // Native: try expo-clipboard dynamically
  try {
    const mod = await import('expo-clipboard');
    if (mod && typeof mod.setStringAsync === 'function') {
      await mod.setStringAsync(text);
      return true;
    }
  } catch {
    // expo-clipboard not installed — not a blocker, just means copy unavailable on native
  }

  // Final fallback for environments with navigator.clipboard (e.g. some RN web views)
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
