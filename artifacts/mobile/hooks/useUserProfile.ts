import { useCallback, useEffect, useState } from 'react';
import {
  profileStore,
  emptyUserProfile,
  type UserProfile,
  type UserProfilePatch,
} from '@/lib/profile';

/** React mirror of the local ProfileStore. */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(emptyUserProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    profileStore.ensureLoaded().then((p) => {
      if (!cancelled) {
        setProfile(p);
        setReady(true);
      }
    });
    const unsub = profileStore.onChange(setProfile);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const updateProfile = useCallback(async (patch: UserProfilePatch) => {
    return profileStore.update(patch);
  }, []);

  return { profile, ready, updateProfile };
}
