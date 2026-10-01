import { useEffect, useState } from 'react';
import { cloudSyncEngine } from '@/lib/cloud';
import type { CloudEngineState } from '@/lib/cloud';

export function useCloudAccount() {
  const [state, setState] = useState<CloudEngineState>(cloudSyncEngine.getState());

  useEffect(() => cloudSyncEngine.subscribe(() => {
    setState(cloudSyncEngine.getState());
  }), []);

  return {
    ...state,
    signIn: (email: string, password: string) => cloudSyncEngine.signIn(email, password),
    signUp: (email: string, password: string) => cloudSyncEngine.signUp(email, password),
    signOut: () => cloudSyncEngine.signOut(),
    recoverPassword: (email: string) => cloudSyncEngine.recoverPassword(email),
    resendSignupConfirmation: (email: string) => cloudSyncEngine.resendSignupConfirmation(email),
    dismissPendingConfirmation: () => cloudSyncEngine.dismissPendingConfirmation(),
    sync: () => cloudSyncEngine.sync(),
  };
}
