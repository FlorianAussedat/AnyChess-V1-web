import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { SupabaseCloudRemote } from '../SupabaseCloud.ts';
import type { SupabaseCloudAuth } from '../SupabaseCloud.ts';
import { MemoryCloudAuth } from '../MemoryCloud.ts';
import { AsyncKeyValueStorage, subscribeKeyValueWrites } from '../../storage/AsyncKeyValueStorage.ts';
import type { KeyValueStorage } from '../../storage/KeyValueStorage.ts';
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
async function phone(client:'dev'|'preview', storage:KeyValueStorage=new MemoryKeyValueStorage(), observeWrites=false){
  process.env.EXPO_PUBLIC_APP_CLIENT=client;assert.equal(authClientVariant(),client);
  const auth=new MemoryCloudAuth();auth.seed('demo@example.com','secret1','shared-owner');
  const remoteAuth={token:()=>`${client}-fixture-jwt`,refreshSession:async()=>false} as unknown as SupabaseCloudAuth;
  const remote=new SupabaseCloudRemote(remoteAuth);
  const engine=new CloudSyncEngine(storage,auth,remote);engines.add(engine);
  let localNotifications=0;
  const unsubscribe=observeWrites ? subscribeKeyValueWrites((k,source)=>{if(source!=='cloud' && SYNCABLE_STORAGE_KEYS.includes(k as any)){localNotifications++;engine.notifyLocalMutation(k);}}) : ()=>{};
  await engine.signIn('demo@example.com','secret1');
  return{storage,engine,auth,remote,client,unsubscribe,get localNotifications(){return localNotifications;}};
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

function jsonbOrder(value:any):any {
  if(Array.isArray(value))return value.map(jsonbOrder);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort((a,b)=>a.length-b.length || a.localeCompare(b)).map(k=>[k,jsonbOrder(value[k])]));
  return value;
}
it('converges through the real REST adapter with JSONB key reordering, then makes zero writes or recovery copies on three unchanged syncs',async()=>{
  const fetch=globalThis.fetch; let writes=0;
  globalThis.fetch=async(input,init)=>{
    if(init?.method!=='GET')writes++;
    const response=await fetch(input,init);
    if(init?.method==='GET')return Response.json(jsonbOrder(await response.json()));
    return response;
  };
  const initial={
    [key]:JSON.parse(library(file('original'))),
    [StorageKeys.userPreferences.key]:{language:'fr',chessNotation:'fr',version:1},
    [StorageKeys.pgnCommentTranslations.key]:{version:1,records:{anchor:{text:'PRIVATE_TRANSLATION_'.repeat(1000),status:'ready'}}},
    [StorageKeys.pgnTranslationQueue.key]:{version:1,jobs:{job:{text:'demo',status:'pending'}}},
    [StorageKeys.chessCultureHistory.key]:{seen:['a','b'],version:1},
    [StorageKeys.userProfile.key]:{username:'Demo',mascotId:'knight'},
  };
  for(const [doc_key,payload] of Object.entries(initial))rows.set(`shared-owner:${doc_key}`,{user_id:'shared-owner',doc_key,payload,revision:1,updated_at:'2026-01-01',deleted_at:null});
  rows.set('other-owner:private',{user_id:'other-owner',doc_key:key,payload:{files:[{id:'OTHER_ACCOUNT'}]},revision:3});
  const other=JSON.stringify(rows.get('other-owner:private'));
  const raw=new MemoryKeyValueStorage(),storage=new AsyncKeyValueStorage(raw);
  const p=await phone('preview',storage,true);
  // Existing local JSON has the same values but the application's insertion order.
  for(const [k,v] of Object.entries(initial))await storage.updateItem(k,()=>JSON.stringify(v),'cloud');
  const unsubscribe=p.unsubscribe;
  try {
    await p.engine.sync();
    assert.equal(p.engine.getState().status,'synced');
    const before=new Map(await Promise.all((await raw.getAllKeys()).map(async k=>[k,await raw.getItem(k)] as const)));
    const count=writes;
    for(let i=0;i<3;i++){await p.engine.sync();assert.equal(p.engine.getState().status,'synced');}
    assert.equal(writes,count,'no unnecessary Supabase writes after convergence');
    assert.equal(p.localNotifications,0,'cloud restoration is not a user mutation');
    assert.equal(p.engine.getState().syncAudit?.pushes,0);
    assert.equal(p.engine.getState().syncAudit?.applies,0);
    assert.deepEqual(p.engine.getState().syncAudit?.pending,[]);
    assert.deepEqual(new Map(await Promise.all((await raw.getAllKeys()).map(async k=>[k,await raw.getItem(k)] as const))),before,'no backup/block growth after convergence');
    setCloudTransferReadersForTests({transport:async()=>'offline'});
    const edit=JSON.parse((await storage.getItem(key))!);edit.files[0].pgnText='1. e4 {offline edit} (1. c4 e5) e5 $3 *';
    await storage.setItem(key,JSON.stringify(edit));await p.engine.sync();assert.equal(p.engine.getState().status,'offline');
    setCloudTransferReadersForTests({transport:async()=>'cellular'});
    await p.engine.sync();assert.equal(p.engine.getState().status,'synced');assert.ok(writes>count);
    assert.match(JSON.stringify(rows.get(`shared-owner:${key}`)),/offline edit/);
    assert.match((await storage.getItem(key))!,/\(1\. c4 e5\)|\$3/);
    assert.match((await storage.getItem(StorageKeys.pgnCommentTranslations.key))!,/PRIVATE_TRANSLATION/);
    assert.equal(JSON.stringify(rows.get('other-owner:private')),other);
  } finally {unsubscribe();}
});

it('keeps merge fixed points across JSONB ordering for all 18 categories and never invents timestamps',async()=>{
  const { mergeDocumentPayload }=await import('../mergeDocuments.ts');
  const { documentPayloadsEqual }=await import('../documentEquality.ts');
  const source={version:1,z:'PGN {comment} (variation)',a:{second:2,first:1},list:[{b:2,a:1},'second']};
  for(const key of SYNCABLE_STORAGE_KEYS) {
    const local=JSON.stringify(source),remote=JSON.stringify(jsonbOrder(source));
    assert.equal(documentPayloadsEqual(local,remote),true);
    assert.equal(mergeDocumentPayload(key,local,remote),local);
  }
  const first=mergeDocumentPayload(StorageKeys.userPreferences.key,'{"language":"fr"}','{"voiceEnabled":true}')!;
  assert.equal('updatedAt' in JSON.parse(first),false);
  for(let i=0;i<3;i++)assert.equal(mergeDocumentPayload(StorageKeys.userPreferences.key,first,JSON.stringify(jsonbOrder(JSON.parse(first)))),first);
  assert.equal(documentPayloadsEqual('[1,2]','[2,1]'),false);
  assert.equal(documentPayloadsEqual('{"pgn":"1. e4 {A}"}','{"pgn":"1. e4 {B}"}'),false);
  assert.equal(documentPayloadsEqual('broken','{}'),false);
});
