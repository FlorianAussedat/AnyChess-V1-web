export type CloudSyncStatus =
  | 'unconfigured'
  | 'signed_out'
  | 'synced'
  | 'pending'
  | 'syncing'
  | 'error'
  | 'offline'
  | 'waiting_wifi';

export type PendingConfirmationReason = 'signup' | 'signin';

export type CloudUser = {
  id: string;
  email: string;
};

export type CloudSession = {
  accessToken: string;
  refreshToken?: string;
  user: CloudUser;
};

export type CloudDocument = {
  docKey: string;
  payload: string | null;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
};

export type CloudAuthError =
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'confirm_email'
  | 'email_not_confirmed'
  | 'email_invalid'
  | 'rate_limited'
  | 'offline'
  | 'rejected'
  | 'unexpected'
  | 'unconfigured'
  | 'signup_ambiguous'
  | 'timeout'
  | 'service_unavailable'
  | 'session_expired'
  | 'local_save_failed';

export type CloudAuthResult =
  | { ok: true; user: CloudUser }
  | {
      ok: false;
      error: CloudAuthError;
      message?: string;
      email?: string;
      pendingUserId?: string;
      retryAfterSeconds?: number;
    };

export type AuthAttemptOptions = { abandoned?: () => boolean };

export interface CloudAuth {
  configured: boolean;
  /** The adapter detaches server revocation and awaits only durable local cleanup. */
  readonly localSignOutOnly?: boolean;
  hydrate?(): Promise<CloudUser | null>;
  token?(): string | null;
  getUser(): Promise<CloudUser | null>;
  probeAccount?(): Promise<'exists' | 'gone' | 'unknown'>;
  signUp(email: string, password: string, options?: AuthAttemptOptions): Promise<CloudAuthResult>;
  signIn(email: string, password: string, options?: AuthAttemptOptions): Promise<CloudAuthResult>;
  signOut(): Promise<void>;
  resendSignupConfirmation(email: string): Promise<{ ok: boolean; error?: CloudAuthError }>;
  recoverPassword(email: string): Promise<{ ok: boolean; error?: CloudAuthError }>;
}

export interface CloudRemote {
  listDocuments(userId: string): Promise<CloudDocument[]>;
  upsertDocument(userId: string, doc: CloudDocument): Promise<void>;
}

export type CloudSnapshot = {
  ownerId: string;
  docs: Record<string, string | null>;
};
