import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { setCloudTransferReadersForTests } from '../../cloud/syncTransport.ts';
import { commitAvatarChange, flushPendingAvatar } from '../avatarRemote.ts';
import {
  avatarCacheKey,
  PENDING_AVATAR_KEY,
  readAvatarCache,
  readPendingAvatar,
  savePendingAvatar,
  writeAvatarCache,
} from '../avatarLocal.ts';
import { ProfileStore } from '../ProfileStore.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';

const OLD = 'data:image/png;base64,b2xk';
const NEXT = 'data:image/png;base64,bmV3';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
beforeEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-fixture';
  setCloudTransferReadersForTests({
    transport: async () => 'wifi',
    wifiOnly: async () => false,
  });
});
afterEach(() => {
  if (url === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = url;
  if (key === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
  setCloudTransferReadersForTests({ transport: null, wifiOnly: null });
});
function input(storage: MemoryKeyValueStorage) {
  return {
    storage,
    userId: 'account-a',
    email: 'A@example.com',
    accessToken: 'fixture',
    dataUrl: NEXT,
  };
}

describe('avatar durability, account boundaries, and existing retries', () => {
  it('keeps a restoration retry for the original account if remote compensation fails', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-a', OLD);
    await writeAvatarCache(storage, 'account-b', NEXT);
    let cancelled = false,
      requests = 0;
    const result = await commitAvatarChange({
      ...input(storage),
      cancelled: () => cancelled,
      fetchImpl: async () => {
        requests++;
        cancelled = true;
        return new Response(null, { status: requests === 1 ? 200 : 503 });
      },
    });
    assert.equal(result, 'failed');
    assert.equal(await readAvatarCache(storage, 'account-a'), OLD);
    assert.equal(await readAvatarCache(storage, 'account-b'), NEXT);
    assert.deepEqual(await readPendingAvatar(storage), {
      email: 'a@example.com',
      dataUrl: OLD,
      intent: 'upload',
    });
  });

  it('serializes concurrent profile edits without losing independent fields', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new ProfileStore(storage);
    await Promise.all([
      store.update({ username: 'Ada' }),
      store.update({ rapidRangeId: '1600-1799' }),
      store.update({ chessYears: 9 }),
      store.update({ mascotId: 'player-knight-dj' }),
    ]);
    const restored = await new ProfileStore(storage).ensureLoaded();
    assert.equal(restored.username, 'Ada');
    assert.equal(restored.rapidRangeId, '1600-1799');
    assert.equal(restored.chessYears, 9);
    assert.equal(restored.mascotId, 'player-knight-dj');
  });
  it('restores the previous pending intent when a cache write fails', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-a', OLD);
    await savePendingAvatar(storage, 'A@example.com', OLD);
    const beforePending = await storage.getItem(PENDING_AVATAR_KEY);
    const write = storage.setItem.bind(storage);
    storage.setItem = async (key, value) => {
      if (key === avatarCacheKey('account-a')) throw Error('disk full');
      await write(key, value);
    };
    let calls = 0;
    assert.equal(
      await commitAvatarChange({
        ...input(storage),
        fetchImpl: async () => {
          calls++;
          return new Response(null);
        },
      }),
      'failed',
    );
    assert.equal(await readAvatarCache(storage, 'account-a'), OLD);
    assert.equal(await storage.getItem(PENDING_AVATAR_KEY), beforePending);
    assert.equal(calls, 0);
  });

  it('keeps the old avatar if the retry intent cannot be written', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-a', OLD);
    const write = storage.setItem.bind(storage);
    storage.setItem = async (key, value) => {
      if (key === PENDING_AVATAR_KEY) throw Error('disk full');
      await write(key, value);
    };
    const update = storage.updateItem.bind(storage);
    storage.updateItem = async (key, change) => {
      if (key === PENDING_AVATAR_KEY) throw Error('disk full');
      await update(key, change);
    };
    assert.equal(await commitAvatarChange(input(storage)), 'failed');
    assert.equal(await readAvatarCache(storage, 'account-a'), OLD);
    assert.equal(await readPendingAvatar(storage), null);
  });

  it('keeps an offline photo durable across reopening and isolated from another account', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-b', OLD);
    setCloudTransferReadersForTests({
      transport: async () => 'offline',
      wifiOnly: async () => true,
    });
    assert.equal(await commitAvatarChange(input(storage)), 'offline');
    assert.equal(await readAvatarCache(storage, 'account-a'), NEXT);
    assert.equal(await readAvatarCache(storage, 'account-b'), OLD);
    assert.equal((await readPendingAvatar(storage))?.email, 'a@example.com');
    const b = await flushPendingAvatar({
      storage,
      userId: 'account-b',
      email: 'b@example.com',
      accessToken: 'fixture',
      fetchImpl: async () => {
        throw Error('must not transfer another account avatar');
      },
    });
    assert.equal(b, 'skipped');
    assert.equal((await readPendingAvatar(storage))?.dataUrl, NEXT);
  });

  it('persists a mascot id without image bytes or any upload, using the existing pending intent', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-a', OLD);
    let calls = 0;
    assert.equal(
      await commitAvatarChange({
        ...input(storage),
        dataUrl: null,
        mascotId: 'player-knight-dj',
        fetchImpl: async () => {
          calls++;
          return new Response(null);
        },
      }),
      'stored',
    );
    assert.deepEqual(await readPendingAvatar(storage), {
      email: 'a@example.com',
      dataUrl: '',
      intent: 'mascot',
      mascotId: 'player-knight-dj',
    });
    assert.equal(await readAvatarCache(storage, 'account-a'), null);
    assert.equal(calls, 0);
  });

  it('keeps a local upload and a retry on a network failure; removal failure keeps the old photo', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-a', OLD);
    const fail: typeof fetch = async () => new Response(null, { status: 503 });
    assert.equal(
      await commitAvatarChange({ ...input(storage), fetchImpl: fail }),
      'sync_failed',
    );
    assert.equal(await readAvatarCache(storage, 'account-a'), NEXT);
    assert.equal((await readPendingAvatar(storage))?.intent, 'upload');
    assert.equal(
      await commitAvatarChange({
        ...input(storage),
        dataUrl: null,
        fetchImpl: fail,
      }),
      'failed',
    );
    assert.equal(await readAvatarCache(storage, 'account-a'), NEXT);
    assert.equal((await readPendingAvatar(storage))?.intent, 'upload');
  });

  it('queues offline removal so the old photo does not return after reopening', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-a', OLD);
    setCloudTransferReadersForTests({
      transport: async () => 'offline',
      wifiOnly: async () => true,
    });
    assert.equal(
      await commitAvatarChange({ ...input(storage), dataUrl: null }),
      'offline',
    );
    assert.equal(await readAvatarCache(storage, 'account-a'), null);
    assert.equal((await readPendingAvatar(storage))?.intent, 'remove');
  });

  it('restores the previous remote photo instead of deleting it when a save is cancelled', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-a', OLD);
    let cancelled = false;
    const bodies: string[] = [];
    const result = await commitAvatarChange({
      ...input(storage),
      cancelled: () => cancelled,
      fetchImpl: async (_url, init) => {
        assert.equal(init?.method, 'POST');
        bodies.push(Buffer.from(init!.body as Uint8Array).toString());
        if (bodies.length === 1) cancelled = true;
        return new Response(null, { status: 200 });
      },
    });
    assert.equal(result, 'cancelled');
    assert.deepEqual(bodies, ['new', 'old']);
    assert.equal(await readAvatarCache(storage, 'account-a'), OLD);
    assert.equal(await readPendingAvatar(storage), null);
  });

  it('does not start an edit cancelled by unmount/account switching', async () => {
    const storage = new MemoryKeyValueStorage();
    await writeAvatarCache(storage, 'account-a', OLD);
    assert.equal(
      await commitAvatarChange({ ...input(storage), cancelled: () => true }),
      'cancelled',
    );
    assert.equal(await readAvatarCache(storage, 'account-a'), OLD);
    assert.equal(await readPendingAvatar(storage), null);
  });

  it('publishes profile fields only after persistence and keeps their prior values on a failed write', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new ProfileStore(storage);
    await store.update({
      username: 'Ada',
      rapidRangeId: '1600-1799',
      blitzRangeId: '1200-1399',
      bulletRangeId: '800-999',
      chessYears: 7,
      mascotId: 'player-knight-dj',
    });
    const before = store.getProfile();
    let emits = 0;
    store.onChange(() => {
      emits++;
    });
    const write = storage.setItem.bind(storage);
    storage.setItem = async () => {
      throw Error('disk full');
    };
    await assert.rejects(store.update({ username: 'Lost', mascotId: null }));
    assert.deepEqual(store.getProfile(), before);
    assert.equal(emits, 0);
    storage.setItem = write;
    assert.deepEqual(await new ProfileStore(storage).ensureLoaded(), before);
    assert.ok(await storage.getItem(StorageKeys.userProfile.key));
  });
});
