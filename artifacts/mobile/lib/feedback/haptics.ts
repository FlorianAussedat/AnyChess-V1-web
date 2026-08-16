/**
 * Shared haptic severity levels for move input UX.
 * Key tap ≠ wrong move ≠ invalid parse.
 */
import * as Haptics from 'expo-haptics';

export type HapticKind = 'keyTap' | 'incorrect' | 'invalid' | 'success';

export async function triggerHaptic(kind: HapticKind): Promise<void> {
  try {
    switch (kind) {
      case 'keyTap':
        // Very light — almost imperceptible tactile tick.
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'incorrect':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      case 'invalid':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
    }
  } catch {
    /* haptics optional (web / denied) */
  }
}
