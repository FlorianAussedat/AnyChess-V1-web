import { useCloudAccount } from '@/hooks/useCloudAccount';
import { personalPgnWritesBlocked } from '@/lib/repertoire/personalPgnAccess';

/** Personal opening studies are visible and editable only for a signed-in account. */
export function usePersonalPgnAccess() {
  const cloud = useCloudAccount();
  return {
    ready: cloud.sessionReady,
    signedIn: Boolean(cloud.user),
    locked: personalPgnWritesBlocked(cloud),
  };
}
