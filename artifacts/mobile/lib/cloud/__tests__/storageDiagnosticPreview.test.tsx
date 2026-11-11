import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { AsyncKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { setCloudEngineForTests } from '../cloudStore.ts';
import { CloudAccountSection } from '../../../components/cloud/CloudAccountSection.tsx';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { storageReportText, syncReportText } from '../../storage/storageReportText.ts';
import { translate } from '../../i18n/messages.ts';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const oldClient = process.env.EXPO_PUBLIC_APP_CLIENT,
  oldDev = (globalThis as any).__DEV__;
const engines: CloudSyncEngine[] = [];
afterEach(() => {
  for (const e of engines) e.dispose();
  engines.length = 0;
  setCloudEngineForTests(null);
  if (oldClient === undefined) delete process.env.EXPO_PUBLIC_APP_CLIENT;
  else process.env.EXPO_PUBLIC_APP_CLIENT = oldClient;
  (globalThis as any).__DEV__ = oldDev;
});
it('shows a read-only storage report in Preview Release and closes it without changing durable values', async () => {
  process.env.EXPO_PUBLIC_APP_CLIENT = 'preview';
  (globalThis as any).__DEV__ = false;
  const raw = new MemoryKeyValueStorage(),
    storage = new AsyncKeyValueStorage(raw),
    auth = new MemoryCloudAuth();
  const engine = new CloudSyncEngine(storage, auth, new MemoryCloudRemote());
  engines.push(engine);
  setCloudEngineForTests(engine);
  await storage.setItem(
    StorageKeys.repertoires.key,
    JSON.stringify({ private: 'PRIVATE_PGN_'.repeat(9000) }),
  );
  const keys = await raw.getAllKeys(),
    before = await Promise.all(keys.map((k) => raw.getItem(k)));
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(React.createElement(CloudAccountSection));
  });
  await act(async () => {
    renderer.root
      .findByProps({ testID: 'cloud-storage-diagnostics' })
      .props.onPress();
  });
  const dialog = renderer.root
    .findAllByProps({ testID: 'cloud-storage-report' })
    .find((n) => typeof n.props.message === 'string')!;
  assert.equal(dialog.props.visible, true);
  assert.match(dialog.props.message, /Volumes logiques|Logical category/);
  assert.doesNotMatch(dialog.props.message, /PRIVATE_PGN|anychess\.repertoire/);
  await act(async () => {
    dialog.props.onConfirm();
  });
  assert.equal(
    renderer.root
      .findAllByProps({ testID: 'cloud-storage-report' })
      .find((n) => 'visible' in n.props)!.props.visible,
    false,
  );
  assert.deepEqual(await raw.getAllKeys(), keys);
  assert.deepEqual(await Promise.all(keys.map((k) => raw.getItem(k))), before);
  await act(async () => renderer.unmount());
});
it('formats safe numbers and fixed failure stages in both French and English', async () => {
  const raw = new MemoryKeyValueStorage(),
    storage = new AsyncKeyValueStorage(raw);
  await storage.setItem(StorageKeys.repertoires.key, 'PRIVATE_CONTENT');
  const report = await storage.diagnoseStorage();
  report.lastFailure = {
    stage: 'storage.pool.block_write',
    kind: 'local_quota',
    category: 0,
    requestedBytes: 123456,
  };
  for (const language of ['fr', 'en'] as const) {
    const text = storageReportText(report, (key, vars) =>
      translate(language, key, vars),
    );
    assert.match(text, /storage\.pool\.block_write/);
    assert.match(text, /121/);
    assert.doesNotMatch(text, /PRIVATE_CONTENT|anychess\.repertoire|\{size\}/);
  }
});

it('formats session-only sync counts and fixed follow-up reasons in FR/EN without leaking documents',()=>{
  for (const language of ['fr','en'] as const) {
    const text=syncReportText({passes:3,reads:2,pushes:0,applies:0,pending:[{category:0,reason:'remote_differs'},{category:null,reason:'local_mutation'}]},(key,vars)=>translate(language,key,vars));
    assert.match(text,/3/);assert.match(text,/2/);assert.match(text,/0/);
    assert.doesNotMatch(text,/sync\.reason|sync\.allCategories|\{passes\}|anychess\.repertoire/);
  }
});
