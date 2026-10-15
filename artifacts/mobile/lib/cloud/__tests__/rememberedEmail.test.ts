import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { SYNCABLE_STORAGE_KEYS } from '../syncableKeys.ts';
import {
  REMEMBERED_EMAIL_KEY,
  clearRememberedEmail,
  readRememberedEmail,
  rememberEmailAfterSignIn,
} from '../rememberedEmail.ts';

describe('remembered email', () => {
  it('stays off until a successful sign-in asks for it, and never stores a password', async () => {
    const storage = new MemoryKeyValueStorage();
    assert.deepEqual(await readRememberedEmail(storage), { enabled: false, email: null });
    await rememberEmailAfterSignIn(storage, 'Ada@Example.com', false);
    assert.equal(await storage.getItem(REMEMBERED_EMAIL_KEY), null);
    await rememberEmailAfterSignIn(storage, 'Ada@Example.com', true);
    const saved = await readRememberedEmail(storage);
    assert.equal(saved.enabled, true);
    assert.equal(saved.email, 'ada@example.com');
    assert.equal((await storage.getItem(REMEMBERED_EMAIL_KEY))?.includes('secret'), false);
    await clearRememberedEmail(storage);
    assert.equal(await storage.getItem(REMEMBERED_EMAIL_KEY), null);
    assert.equal(SYNCABLE_STORAGE_KEYS.includes(REMEMBERED_EMAIL_KEY as never), false);
  });
});
