import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { ProfileStore } from '../../profile/ProfileStore.ts';
import { submitCreateAccount } from '../../profile/createAccount.ts';
import { PENDING_AVATAR_KEY } from '../../profile/avatarLocal.ts';
import { centerCropRect, fittedEdge } from '../../profile/avatarImage.ts';
import { initialsFromUsername } from '../../profile/avatarInitials.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { performAccountDeletion, resumePendingAccountDeletion } from '../accountLifecycle.ts';
import {
  CLOUD_BACKUP_INDEX_KEY,
  GUEST_OWNER_ID,
  cloudWorkspaceKey,
} from '../syncableKeys.ts';
import { readDeletionPending } from '../purgeAccountLocal.ts';

const here = dirname(fileURLToPath(import.meta.url));
const PROFILE = StorageKeys.userProfile.key;

class TokenAuth extends MemoryCloudAuth {
  token(): string {
    return 'user-token';
  }
}

async function signedInEngine() {
  const storage = new MemoryKeyValueStorage();
  const auth = new TokenAuth();
  const remote = new MemoryCloudRemote();
  const engine = new CloudSyncEngine(storage, auth, remote);
  await storage.setItem(PROFILE, JSON.stringify({ username: 'Invite' }));
  await engine.parkWorkspace(GUEST_OWNER_ID);
  await storage.setItem(
    cloudWorkspaceKey('other-user'),
    JSON.stringify({ ownerId: 'other-user', docs: { [PROFILE]: '{"username":"Bob"}' } }),
  );
  const created = await engine.signUp('ada@example.com', 'secret1');
  assert.equal(created.ok, true);
  await storage.setItem(PROFILE, JSON.stringify({ username: 'Ada' }));
  await engine.parkWorkspace(created.ok ? created.user.id : 'missing');
  await engine.backupLocal();
  const guestBackupKey = 'anychess.cloud.backup.guest-keep.v1';
  await storage.setItem(guestBackupKey, JSON.stringify({ version: 2, ownerId: GUEST_OWNER_ID, docs: {} }));
  const indexRaw = await storage.getItem(CLOUD_BACKUP_INDEX_KEY);
  const index = indexRaw ? (JSON.parse(indexRaw) as { key: string; ownerId: string }[]) : [];
  index.push({ key: guestBackupKey, ownerId: GUEST_OWNER_ID });
  await storage.setItem(CLOUD_BACKUP_INDEX_KEY, JSON.stringify(index));
  return { storage, engine, userId: created.ok ? created.user.id : '' };
}

describe('create account', () => {
  it('keeps the pseudo, stores a pending avatar, and never writes the password', async () => {
    const storage = new MemoryKeyValueStorage();
    const profiles = new ProfileStore(storage);
    let seenPassword = '';
    const result = await submitCreateAccount({
      username: '  Ada  ',
      email: 'ada@example.com',
      password: 'secret1',
      avatarDataUrl: 'data:image/png;base64,aaaa',
      storage,
      updateUsername: async (username) => {
        await profiles.update({ username });
      },
      signUp: async (_email, password) => {
        seenPassword = password;
        return { ok: false, error: 'confirm_email' };
      },
    });
    assert.equal(result.error, 'confirm_email');
    assert.equal(seenPassword, 'secret1');
    const raw = await storage.getItem(PROFILE);
    assert.ok(raw);
    assert.equal(JSON.parse(raw!).username, 'Ada');
    assert.equal(raw!.includes('secret1'), false);
    const pending = JSON.parse((await storage.getItem(PENDING_AVATAR_KEY))!);
    assert.equal(pending.email, 'ada@example.com');
    assert.equal(pending.dataUrl.startsWith('data:image/png'), true);
    assert.equal(JSON.stringify(pending).includes('secret1'), false);
  });

  it('keeps the typed pseudo when sign-up fails', async () => {
    const storage = new MemoryKeyValueStorage();
    const profiles = new ProfileStore(storage);
    const result = await submitCreateAccount({
      username: 'Ada',
      email: 'ada@example.com',
      password: 'secret1',
      avatarDataUrl: null,
      storage,
      updateUsername: async (username) => {
        await profiles.update({ username });
      },
      signUp: async () => ({ ok: false, error: 'email_taken' }),
    });
    assert.equal(result.error, 'email_taken');
    assert.equal((await profiles.ensureLoaded()).username, 'Ada');
    assert.equal(await storage.getItem(PENDING_AVATAR_KEY), null);
  });
});

describe('account deletion', () => {
  it('cancels nothing on the server when the dialog is only dismissed', () => {
    const source = readFileSync(
      join(here, '../../../components/cloud/DeleteAccountControl.tsx'),
      'utf8',
    );
    assert.match(source, /account-delete-cancel/);
    assert.match(source, /testID: 'account-delete-cancel'/);
    assert.match(source, /onPress: \(\) => \{\}/);
  });

  it('keeps local data when reauthentication fails', async () => {
    const { storage, engine, userId } = await signedInEngine();
    const result = await performAccountDeletion(engine, 'wrong', {
      request: async () => ({ status: 401, body: JSON.stringify({ error: 'reauth_failed' }) }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'reauth_failed');
    assert.equal(engine.getState().user?.id, userId);
    assert.match((await storage.getItem(PROFILE)) ?? '', /Ada/);
    assert.match((await storage.getItem(cloudWorkspaceKey(userId))) ?? '', /Ada/);
    assert.match((await storage.getItem(cloudWorkspaceKey(GUEST_OWNER_ID))) ?? '', /Invite/);
    assert.equal(await readDeletionPending(storage), null);
  });

  it('wipes only the signed-in account after the server confirms', async () => {
    const { storage, engine, userId } = await signedInEngine();
    const result = await performAccountDeletion(engine, 'secret1', {
      request: async (_token, password) => {
        assert.equal(password, 'secret1');
        return { status: 200, body: JSON.stringify({ ok: true }) };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(engine.getState().user, null);
    assert.equal(await storage.getItem(cloudWorkspaceKey(userId)), null);
    assert.match((await storage.getItem(PROFILE)) ?? '', /Invite/);
    assert.match((await storage.getItem(cloudWorkspaceKey(GUEST_OWNER_ID))) ?? '', /Invite/);
    assert.match((await storage.getItem(cloudWorkspaceKey('other-user'))) ?? '', /Bob/);
    const index = JSON.parse((await storage.getItem(CLOUD_BACKUP_INDEX_KEY)) ?? '[]') as {
      ownerId: string;
    }[];
    assert.equal(index.some((row) => row.ownerId === userId), false);
    assert.equal(index.some((row) => row.ownerId === GUEST_OWNER_ID), true);
    assert.equal(await storage.getItem('anychess.avatar.cache.' + userId), null);
  });

  it('finishes cleanup when the server deleted the account but the response was lost', async () => {
    const { storage, engine, userId } = await signedInEngine();
    const lost = await performAccountDeletion(engine, 'secret1', {
      request: async () => 'network',
      probe: async () => 'unknown',
    });
    assert.equal(lost.ok, false);
    if (!lost.ok) assert.equal(lost.error, 'offline');
    assert.equal(engine.getState().user?.id, userId);
    assert.match((await storage.getItem(PROFILE)) ?? '', /Ada/);
    const pending = await readDeletionPending(storage);
    assert.equal(pending?.userId, userId);

    await resumePendingAccountDeletion(engine, async () => 'gone');
    assert.equal(engine.getState().user, null);
    assert.equal(await storage.getItem(cloudWorkspaceKey(userId)), null);
    assert.match((await storage.getItem(PROFILE)) ?? '', /Invite/);
    assert.match((await storage.getItem(cloudWorkspaceKey('other-user'))) ?? '', /Bob/);
    assert.equal(await readDeletionPending(storage), null);
  });

  it('does not sync while a deletion is in progress', async () => {
    const { engine } = await signedInEngine();
    engine.beginAccountDeletion();
    const state = await engine.sync();
    assert.equal(state.user?.email, 'ada@example.com');
    engine.releaseAccountDeletion();
  });

  it('keeps the pseudo when the same account signs in again', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const engine = new CloudSyncEngine(storage, auth, new MemoryCloudRemote());
    await storage.setItem(PROFILE, JSON.stringify({ username: 'Ada' }));
    const created = await engine.signUp('ada@example.com', 'secret1');
    assert.equal(created.ok, true);
    await engine.signOut();
    await storage.setItem(PROFILE, JSON.stringify({ username: 'Invite' }));
    const again = await engine.signIn('ada@example.com', 'secret1');
    assert.equal(again.ok, true);
    assert.match((await storage.getItem(PROFILE)) ?? '', /Ada/);
  });
});

describe('avatar helpers', () => {
  it('builds initials and a proportional crop', () => {
    assert.equal(initialsFromUsername('ada'), 'AD');
    assert.equal(initialsFromUsername('Ada Lovelace'), 'AL');
    assert.equal(initialsFromUsername(null), '?');
    const full = centerCropRect(800, 200, 1);
    assert.equal(full.width, 800);
    assert.equal(full.height, 200);
    const zoomed = centerCropRect(800, 200, 2);
    assert.equal(zoomed.width, 400);
    assert.equal(zoomed.height, 100);
    assert.equal(zoomed.width / zoomed.height, 4);
    const fitted = fittedEdge(800, 200);
    assert.equal(fitted.width, 512);
    assert.equal(fitted.height, 128);
  });

  it('loads a profile that has no avatar flag', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem(
      PROFILE,
      JSON.stringify({
        version: 1,
        id: 'local_test',
        username: 'Ada',
        rapidRangeId: null,
        blitzRangeId: null,
        bulletRangeId: null,
        chessYears: null,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    const store = new ProfileStore(storage);
    const profile = await store.ensureLoaded();
    assert.equal(profile.username, 'Ada');
    assert.equal(profile.hasAvatar, false);
  });
});

describe('account screens', () => {
  it('opens a dedicated create page and keeps deletion on the signed-in account', () => {
    const section = readFileSync(join(here, '../../../components/cloud/CloudAccountSection.tsx'), 'utf8');
    const page = readFileSync(join(here, '../../../app/creer-compte.tsx'), 'utf8');
    const user = readFileSync(join(here, '../../../app/utilisateur.tsx'), 'utf8');
    const client = readFileSync(join(here, '../accountLifecycle.ts'), 'utf8');
    assert.match(section, /cloud-signup/);
    assert.match(section, /\/creer-compte/);
    assert.doesNotMatch(section, /cloud\.signUp\(email/);
    assert.match(section, /cloud\.user \? <DeleteAccountControl/);
    assert.match(page, /create-account-pseudo/);
    assert.match(page, /create-account-email/);
    assert.match(page, /create-account-password-toggle/);
    assert.match(page, /account\.avatarAdd|create-account-avatar/);
    assert.match(page, /account\.alreadyHave/);
    assert.doesNotMatch(page, /rapidRangeId|chessYears|abonnement|stripe/i);
    assert.match(user, /profil-avatar/);
    assert.match(user, /profil-row-username/);
    assert.match(user, /utilisateur-guest-card/);
    assert.doesNotMatch(client, /SERVICE_ROLE|service_role/);
    const settings = readFileSync(join(here, '../../../app/parametres.tsx'), 'utf8');
    assert.match(settings, /parametres-guest-notice/);
    assert.doesNotMatch(settings, /if \(!cloud\.user\) return/);
  });
});
