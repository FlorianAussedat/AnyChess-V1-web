import type {
  CloudAuth,
  CloudAuthResult,
  CloudDocument,
  CloudRemote,
  CloudUser,
} from './types.ts';

type MemoryUser = CloudUser & { password: string };

export class MemoryCloudAuth implements CloudAuth {
  readonly configured = true;
  private current: CloudUser | null = null;
  private readonly users = new Map<string, MemoryUser>();
  recoveries: string[] = [];

  seed(email: string, password: string, id = `user_${this.users.size + 1}`): CloudUser {
    const user = { id, email: email.trim().toLowerCase(), password };
    this.users.set(user.email, user);
    return { id: user.id, email: user.email };
  }

  async getUser(): Promise<CloudUser | null> {
    return this.current;
  }

  async signUp(email: string, password: string): Promise<CloudAuthResult> {
    const key = email.trim().toLowerCase();
    if (password.length < 6) return { ok: false, error: 'weak_password' };
    if (this.users.has(key)) return { ok: false, error: 'email_taken' };
    const user = this.seed(key, password);
    this.current = user;
    return { ok: true, user };
  }

  async signIn(email: string, password: string): Promise<CloudAuthResult> {
    const row = this.users.get(email.trim().toLowerCase());
    if (!row || row.password !== password) return { ok: false, error: 'invalid_credentials' };
    this.current = { id: row.id, email: row.email };
    return { ok: true, user: this.current };
  }

  async signOut(): Promise<void> {
    this.current = null;
  }

  async recoverPassword(email: string): Promise<{ ok: boolean }> {
    this.recoveries.push(email.trim().toLowerCase());
    return { ok: true };
  }
}

export class MemoryCloudRemote implements CloudRemote {
  private readonly docs = new Map<string, Map<string, CloudDocument>>();

  private bucket(userId: string): Map<string, CloudDocument> {
    let row = this.docs.get(userId);
    if (!row) {
      row = new Map();
      this.docs.set(userId, row);
    }
    return row;
  }

  async listDocuments(userId: string): Promise<CloudDocument[]> {
    return [...this.bucket(userId).values()].filter((doc) => !doc.deletedAt);
  }

  async upsertDocument(userId: string, doc: CloudDocument): Promise<void> {
    this.bucket(userId).set(doc.docKey, { ...doc });
  }

  peek(userId: string, docKey: string): CloudDocument | undefined {
    return this.docs.get(userId)?.get(docKey);
  }
}
