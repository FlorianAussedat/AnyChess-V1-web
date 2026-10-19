import { useCloudAccount } from '@/hooks/useCloudAccount';

/** Personal opening studies are visible and editable only for a signed-in account. */
export function usePersonalPgnAccess() {
  const cloud = useCloudAccount();
  return {
    ready: cloud.sessionReady,
    signedIn: Boolean(cloud.user),
    locked: cloud.sessionReady && !cloud.user,
  };
}
