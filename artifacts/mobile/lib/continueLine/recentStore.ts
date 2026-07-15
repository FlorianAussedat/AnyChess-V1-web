/**
 * App wiring for Continue-la-ligne persistence (AsyncStorage).
 * Keep separate from pure logic so Node tests never load React Native modules.
 */
import { defaultKeyValueStorage } from '@/lib/storage';
import { ContinueLineRecentStorage } from './ContinueLineRecentStorage';

export const continueLineRecentStorage = new ContinueLineRecentStorage(
  defaultKeyValueStorage,
);
