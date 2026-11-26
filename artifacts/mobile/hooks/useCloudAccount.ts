import { useEffect, useState } from 'react';
import { getActiveCloudEngine } from '@/lib/cloud';
import type { CloudEngineState } from '@/lib/cloud';

export function useCloudAccount() {
  const [state, setState] = useState<CloudEngineState>(() => getActiveCloudEngine().getState());

  useEffect(() => {
    const engine = getActiveCloudEngine();
    setState(engine.getState());
    return engine.subscribe(() => {
      setState(getActiveCloudEngine().getState());
    });
  }, []);

  return {
    ...state,
    signIn: (
      email: string,
      password: string,
      options?: { abandoned?: () => boolean },
    ) => getActiveCloudEngine().signIn(email, password, options),
    signUp: (email: string, password: string, options?: { abandoned?: () => boolean }) => getActiveCloudEngine().signUp(email, password, options),
    signOut: () => getActiveCloudEngine().signOut(),
    recoverPassword: (email: string) => getActiveCloudEngine().recoverPassword(email),
    resendSignupConfirmation: (email: string) =>
      getActiveCloudEngine().resendSignupConfirmation(email),
    dismissPendingConfirmation: () => getActiveCloudEngine().dismissPendingConfirmation(),
    sync: (options?: { allowCellular?: boolean }) => getActiveCloudEngine().sync(options),
    guestDataAvailable: () => getActiveCloudEngine().guestDataAvailable(),
    importGuestData: () => getActiveCloudEngine().importGuestData(),
  };
}
