import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { SupabaseCloudRemote } from '../SupabaseCloud.ts';
import type { SupabaseCloudAuth } from '../SupabaseCloud.ts';
import { MemoryCloudAuth } from '../MemoryCloud.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { authClientVariant } from '../supabaseConfig.ts';
import { SYNCABLE_STORAGE_KEYS } from '../syncableKeys.ts';
import { setCloudTransferReadersForTests } from '../syncTransport.ts';
const env={...process.env}, oldFetch=globalThis.fetch;
const engines=new Set<CloudSyncEngine>();
const rows=new Map<string,Record<string,any>>();
const requests:string[]=[];
const key=StorageKeys.repertoires.key;
const file=(id:string,text='1. e4 {demo} (1. d4 d5) e5 $1 *')=>({id,filename:'same.pgn',folderId:'nested',pgnText:text,importedAt:'2026-01-01'});
const library=(...files:ReturnType<typeof file>[])=>JSON.stringify({version:2,folders:[{id:'root',name:'Demo',parentId:null},{id:'nested',name:'Nested',parentId:'root'}],files});
beforeEach(()=>{
  rows.clear();requests.length=0;
  process.env.EXPO_PUBLIC_SUPABASE_URL='https://zqfxnzwtptepulmgpxhb.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='public-shared-fixture';
  setCloudTransferReadersForTests({transport:async()=>'wifi'});
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));requests.push(url.origin);
    assert.equal((init?.headers as Record<string,string>).apikey,'public-shared-fixture');
    if(init?.method==='GET') return Response.json([...rows.values()].filter(r=>url.searchParams.get('user_id')===`eq.${r.user_id}`));
    const data=JSON.parse(String(init?.body)),id=`${data.user_id}:${data.doc_key}`,previous=rows.get(id);
    if((init?.method==='POST'&&previous)||(init?.method==='PATCH'&&previous?.revision!==Number(url.searchParams.get('revision')?.slice(3))))return Response.json([]);
    rows.set(id,data);return Response.json([data]);
  };
});
afterEach(()=>{
  for(const engine of engines)engine.dispose();engines.clear();
  globalThis.fetch=oldFetch;setCloudTransferReadersForTests({transport:null});
  for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);
});
async function phone(client:'dev'|'preview'){
  process.env.EXPO_PUBLIC_APP_CLIENT=client;assert.equal(authClientVariant(),client);
  const auth=new MemoryCloudAuth();auth.seed('demo@example.com','secret1','shared-owner');
  const storage=new MemoryKeyValueStorage();
  const remoteAuth={token:()=>`${client}-fixture-jwt`,refreshSession:async()=>false} as unknown as SupabaseCloudAuth;
  const remote=new SupabaseCloudRemote(remoteAuth);
  const engine=new CloudSyncEngine(storage,auth,remote);engines.add(engine);
  await engine.signIn('demo@example.com','secret1');
  return{storage,engine,auth,remote,client};
}
const files=async(p:Awaited<ReturnType<typeof phone>>)=>JSON.parse((await p.storage.getItem(key))!).files;
it('Dev and Preview exchange PGNs and edits with stable recovery copies and no duplication on repeated sync',async()=>{
  const dev=await phone('dev'),preview=await phone('preview');
  await dev.storage.setItem(key,library(file('dev')));await preview.storage.setItem(key,library(file('preview')));
  await Promise.all([dev.engine.sync(),preview.engine.sync()]);
  await dev.engine.sync();await preview.engine.sync();await dev.engine.sync();
  for(const p of [dev,preview])assert.deepEqual((await files(p)).map((f:any)=>f.id).sort(),['dev','preview']);
  const changed=JSON.parse((await preview.storage.getItem(key))!);changed.files.find((f:any)=>f.id==='preview').pgnText='1. d4 {Preview edit} (1. c4 e5) d5 $2 *';
  await preview.storage.setItem(key,JSON.stringify(changed));await preview.engine.sync();await dev.engine.sync();
  assert.match((await dev.storage.getItem(key))!,/Preview edit/);
  const back=JSON.parse((await dev.storage.getItem(key))!);back.files.find((f:any)=>f.id==='dev').pgnText='1. e4 {Dev edit} (1. Nf3 d5) e5 $1 *';
  await dev.storage.setItem(key,JSON.stringify(back));await dev.engine.sync();await preview.engine.sync();
  assert.match((await preview.storage.getItem(key))!,/Dev edit/);
  const before=await preview.storage.getItem(key);
  await preview.engine.sync();await dev.engine.sync();await preview.engine.sync();
  assert.equal(await preview.storage.getItem(key),before);
  const mergedFiles=await files(preview);
  assert.equal(mergedFiles.filter((f:any)=>!f.id.includes('~recovery-')).length,2);
  // Existing conservative protocol preserves older differing PGNs, even for sequential edits.
  assert.equal(mergedFiles.filter((f:any)=>f.id.includes('~recovery-')).length,2);
  assert.equal(mergedFiles.length,4);
  assert.match(JSON.stringify(mergedFiles),/\{demo\}/);
  assert.match(JSON.stringify(mergedFiles),/Preview edit/);
  assert.match(JSON.stringify(mergedFiles),/Dev edit/);
  assert.ok(requests.length>0);assert.deepEqual([...new Set(requests)],['https://zqfxnzwtptepulmgpxhb.supabase.co']);
});
it('keeps package-local documents separate while profile, language and records cross variants',async()=>{
  const dev=await phone('dev'),preview=await phone('preview');
  await dev.storage.setItem('local-only-session','private-dev-session');
  await preview.storage.setItem('local-only-session','private-preview-session');
  await preview.storage.setItem(StorageKeys.userProfile.key,JSON.stringify({username:'Demo Preview',mascotId:'knight',updatedAt:'2026-03-01'}));
  await preview.storage.setItem(StorageKeys.userPreferences.key,JSON.stringify({language:'en',chessNotation:'en',updatedAt:'2026-03-01'}));
  await dev.storage.setItem(StorageKeys.moveNamingSession60.key,JSON.stringify({best:12}));
  await preview.engine.sync();await dev.engine.sync();await preview.engine.sync();
  assert.equal(JSON.parse((await dev.storage.getItem(StorageKeys.userProfile.key))!).username,'Demo Preview');
  assert.equal(JSON.parse((await dev.storage.getItem(StorageKeys.userPreferences.key))!).language,'en');
  assert.equal(JSON.parse((await preview.storage.getItem(StorageKeys.moveNamingSession60.key))!).best,12);
  assert.equal(await dev.storage.getItem('local-only-session'),'private-dev-session');assert.equal(await preview.storage.getItem('local-only-session'),'private-preview-session');
  assert.equal(SYNCABLE_STORAGE_KEYS.length,18);assert.ok(![...rows.values()].some(row=>row.doc_key==='local-only-session'));
});
it('retains a Preview offline edit across restart then makes it available to Dev',async()=>{
  const dev=await phone('dev'),preview=await phone('preview');
  setCloudTransferReadersForTests({transport:async()=>'offline'});
  await preview.storage.setItem(key,library(file('offline')));await preview.engine.sync();assert.equal(preview.engine.getState().status,'offline');
  preview.engine.dispose();const restarted=new CloudSyncEngine(preview.storage,preview.auth,preview.remote);engines.add(restarted);
  await restarted.hydrate();assert.match((await preview.storage.getItem(key))!,/offline/);
  setCloudTransferReadersForTests({transport:async()=>'cellular'});await restarted.sync();await dev.engine.sync();
  assert.deepEqual((await files(dev)).map((f:any)=>f.id),['offline']);
});
it('demonstrates why an old unconditional writer is unsafe even on a table with revision',async()=>{
  const dev=await phone('dev');await dev.storage.setItem(key,library(file('new-client')));await dev.engine.sync();
  const rowId=`shared-owner:${key}`,saved=rows.get(rowId)!;assert.match(JSON.stringify(saved.payload),/new-client/);
  // Simulate the historical server-accepted unconditional upsert; no real backend call.
  rows.set(rowId,{...saved,payload:JSON.parse(library(file('old-client')))});
  const remote=await dev.remote.listDocuments('shared-owner');
  const remoteLibrary=remote.find(row=>row.docKey===key)!;
  assert.doesNotMatch(remoteLibrary.payload!,/new-client/);assert.match(remoteLibrary.payload!,/old-client/);
  assert.match((await dev.storage.getItem(key))!,/new-client/);
});
