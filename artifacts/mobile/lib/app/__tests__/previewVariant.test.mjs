import assert from 'node:assert/strict';
import { it, afterEach } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { checkPreviewBuild } from '../../../scripts/check-preview-build.mjs';
const require = createRequire(import.meta.url);
const { resolveAndroidVariant, DEV_CLIENT_MODULES } = require('../androidVariants.cjs');
const { validatePreviewPublicEnv, PUBLIC_PROJECT_URL, CONFIRM_PAGE_URL } = require('../previewBuild.cjs');
const { injectPreviewSigningGuard } = require('../../../plugins/previewSigning.cjs');
const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const oldEnv = { ...process.env };
afterEach(() => { for (const k of Object.keys(process.env)) if (!(k in oldEnv)) delete process.env[k]; Object.assign(process.env, oldEnv); });
const jwt = (extra = {}) => ['eyJ0eXAiOiJKV1QifQ', Buffer.from(JSON.stringify({role:'anon',ref:'zqfxnzwtptepulmgpxhb',exp:4102444800,...extra})).toString('base64url'), 'fixture'].join('.');
const publicEnv = () => ({ANYCHESS_VARIANT:'preview',EXPO_PUBLIC_APP_CLIENT:'preview',EXPO_PUBLIC_AUTH_CONFIRM_URL:CONFIRM_PAGE_URL,EXPO_PUBLIC_SUPABASE_URL:PUBLIC_PROJECT_URL,EXPO_PUBLIC_SUPABASE_ANON_KEY:jwt()});

it('preserves all three historical Expo configurations and EAS profiles exactly at PR 128', () => {
  const snapshots = read('./fixtures/legacyAndroidConfigs.json');
  process.env.ANYCHESS_PREVIEW_EAS_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
  process.env.ANYCHESS_PREVIEW_EAS_OWNER = 'fixture-owner';
  for (const v of ['development','stable','standalone']) assert.deepEqual(JSON.parse(JSON.stringify(resolveAndroidVariant(v))),snapshots[v]);
  const eas = read('../../../eas.json');
  const old = read('./fixtures/legacyEasProfiles.json');
  for (const v of Object.keys(old.build)) assert.deepEqual(eas.build[v],old.build[v]);
});
it('resolves four distinct Android identities and an autonomous Preview without old signing plugin', () => {
  const configs = ['development','stable','standalone','preview'].map(v=>resolveAndroidVariant(v).expo);
  assert.equal(new Set(configs.map(c=>c.android.package)).size,4);
  assert.equal(new Set(configs.map(c=>c.scheme)).size,4);
  const c=configs[3]; assert.equal(c.name,'AnyChess Preview');assert.equal(c.version,'0.0.7');assert.equal(c.android.package,'com.anychess.preview');assert.equal(c.scheme,'anychesspreview');assert.equal(c.android.versionCode,1);
  assert.deepEqual(c.autolinking.exclude,DEV_CLIENT_MODULES);
  assert.ok(c.plugins.includes('./plugins/withPreviewSigning.js'));
  assert.ok(c.plugins.includes('./modules/stockfish-uci/app.plugin.js'));
  assert.ok(c.plugins.includes('./plugins/withStandaloneAutolinking.js'));
  assert.ok(c.plugins.includes('./plugins/withStandaloneSchemes.js'));
  assert.ok(!c.plugins.includes('expo-dev-client'));assert.ok(!c.plugins.includes('./plugins/withReleaseSigning.js'));
  process.env.ANYCHESS_VARIANT='preview';assert.deepEqual(require('../../../app.config.js')(),resolveAndroidVariant('preview'));
});
it('adds a Preview EAS APK Release profile with remote credentials and no automatic remote initialization', () => {
  const c=read('../../../eas.json').build.preview;
  assert.equal(c.developmentClient,false);assert.equal(c.distribution,'internal');assert.equal(c.environment,'preview');assert.equal(c.credentialsSource,'remote');assert.equal(c.channel,'preview');
  assert.equal(c.android.buildType,'apk');assert.match(c.android.gradleCommand,/:app:assembleRelease/);assert.match(c.android.gradleCommand,/arm64-v8a/);assert.equal(c.env.EXPO_PUBLIC_APP_CLIENT,'preview');
  delete process.env.ANYCHESS_PREVIEW_EAS_PROJECT_ID;delete process.env.ANYCHESS_PREVIEW_EAS_OWNER;
  assert.equal(resolveAndroidVariant('preview').expo.extra.eas,undefined);
  process.env.ANYCHESS_PREVIEW_EAS_PROJECT_ID='11111111-1111-4111-8111-111111111111';process.env.ANYCHESS_PREVIEW_EAS_OWNER='fixture-owner';
  const expo=resolveAndroidVariant('preview').expo;
  assert.equal(expo.extra.eas.projectId,process.env.ANYCHESS_PREVIEW_EAS_PROJECT_ID);assert.equal(expo.owner,'fixture-owner');
  process.env.ANYCHESS_PREVIEW_EAS_PROJECT_ID='invalid';assert.throws(()=>resolveAndroidVariant('preview'),/Invalid/);
});
it('accepts only the shared public project and rejects secret/foreign/expired keys without printing values', () => {
  assert.deepEqual(validatePreviewPublicEnv(publicEnv()),{projectMatches:true,anonRole:true});
  for(const bad of [{EXPO_PUBLIC_SUPABASE_URL:'https://other.supabase.co'}, {EXPO_PUBLIC_APP_CLIENT:'app'}, {EXPO_PUBLIC_AUTH_CONFIRM_URL:'https://other.test/auth/confirm'}, {EXPO_PUBLIC_SUPABASE_ANON_KEY:jwt({role:'service_role'})}, {EXPO_PUBLIC_SUPABASE_ANON_KEY:jwt({ref:'other'})}, {EXPO_PUBLIC_SUPABASE_ANON_KEY:jwt({exp:1})}, {EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_private'}, {EXPO_PUBLIC_DEEPL_API_KEY:'sensitive-fixture'}, {EXPO_PUBLIC_OTHER:jwt({role:'service_role'})}]) {
    assert.throws(()=>validatePreviewPublicEnv({...publicEnv(),...bad}),error=>{assert.doesNotMatch(error.message,/sensitive-fixture|sb_secret_private|eyJ/);return true;});
  }
});
it('the EAS hook validates Preview association and ignores historical profiles without touching their signing', () => {
  const base={...publicEnv(),ANYCHESS_PREVIEW_EAS_OWNER:'fixture-owner',ANYCHESS_PREVIEW_EAS_PROJECT_ID:'11111111-1111-4111-8111-111111111111',EAS_BUILD_PROFILE:'preview'};
  assert.deepEqual(checkPreviewBuild({env:base,hook:true}),{skipped:false,associated:true});
  assert.throws(()=>checkPreviewBuild({env:{...base,ANYCHESS_PREVIEW_EAS_PROJECT_ID:''},hook:true}),/Configure ANYCHESS_PREVIEW/);
  for(const v of ['development','stable','standalone']) assert.deepEqual(checkPreviewBuild({env:{EAS_BUILD_PROFILE:v},hook:true}),{skipped:true});
});
it('inserts an idempotent task-time release signing guard without loading private existing credentials', () => {
  const result=injectPreviewSigningGuard('android {}');assert.equal(injectPreviewSigningGuard(result),result);
  assert.match(result,/com\.anychess\.preview/);assert.match(result,/getCertificate/);assert.match(result,/androiddebugkey/);assert.match(result,/validateSigningRelease/);
  for (const variant of ['stable','standalone']) {
    const certificate=read(`../../../signing/${variant}-release-cert.json`);
    assert.ok(result.includes(certificate.certSha256.replaceAll(':','')));
  }
  assert.doesNotMatch(result,/storePassword\s*=|\.signing\/release.env/);
  const {stripDevClientSchemes}=require('../../../plugins/standaloneSchemes.cjs');
  const manifest={application:[{activity:[{'intent-filter':[{data:[{$:{'android:scheme':'exp+mobile'}},{$:{'android:scheme':'anychesspreview'}}]}]}]}]};
  stripDevClientSchemes(manifest);assert.deepEqual(manifest.application[0].activity[0]['intent-filter'][0].data,[{$:{'android:scheme':'anychesspreview'}}]);
});
