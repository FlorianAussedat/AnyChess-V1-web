import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { SupabaseCloudAuth } from '../SupabaseCloud.ts';
import { authClientVariant, authConfirmRedirectUrl } from '../supabaseConfig.ts';
import { appOpenHref, pageClient, interpretConfirmationLocation } from '../../../../../supabase/functions/auth-confirm/outcome.ts';
import { confirmPageRedirect, PUBLIC_CONFIRM_PAGE_URL } from '../../../../../supabase/functions/auth-confirm/publicPage.ts';
const original = {...process.env}, originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);});
it('constructs Preview confirmation, recovery and resend URLs for both languages on the existing site',()=>{
  process.env.EXPO_PUBLIC_APP_CLIENT='preview';
  process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL=PUBLIC_CONFIRM_PAGE_URL;
  assert.equal(authClientVariant(),'preview');
  for(const lang of ['fr','en']){
    const expected=`${PUBLIC_CONFIRM_PAGE_URL}?client=preview&lang=${lang}`;
    assert.equal(authConfirmRedirectUrl(lang),expected);
    assert.equal(confirmPageRedirect(`https://example.supabase.co/functions/v1/auth-confirm?client=preview&lang=${lang}&access_token=secret&redirect=mobile`),expected);
  }
  process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL='http://untrusted.test/other';
  assert.equal(authConfirmRedirectUrl('fr'),`${PUBLIC_CONFIRM_PAGE_URL}?client=preview&lang=fr`);
  delete process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL;
  assert.equal(authConfirmRedirectUrl('en'),`${PUBLIC_CONFIRM_PAGE_URL}?client=preview&lang=en`);
});
it('preserves old application destinations and isolates Preview against arbitrary query schemes/packages',()=>{
  const expected={dev:['exp+anychessdev','com.anychess.dev'],app:['mobile','com.anychess.app'],standalone:['anychess','com.anychess.standalone'],preview:['anychesspreview','com.anychess.preview']};
  for(const [client,[scheme,pkg]]of Object.entries(expected)){
    const parsed=pageClient(`?client=${client}&scheme=malicious&package=other&access_token=secret`);
    assert.equal(parsed,client);
    assert.equal(appOpenHref(parsed,'Android'),`intent://utilisateur#Intent;scheme=${scheme};package=${pkg};end`);
    assert.equal(appOpenHref(parsed,'iPhone'),`${scheme}://utilisateur`);
    assert.doesNotMatch(appOpenHref(parsed,'Android'),/secret|access_token|refresh_token|malicious/);
  }
  assert.equal(pageClient('?client=preview%3Bpackage%3Dcom.anychess.app'),'standalone');
});
it('does not infer confirmation from Preview client or success query, and rejects expired/PKCE-only links',()=>{
  assert.equal(interpretConfirmationLocation('?client=preview&confirmed=true&success=true',''),'idle');
  assert.equal(interpretConfirmationLocation('?client=preview#error=ignored','#error=access_denied&error_code=otp_expired'),'expired');
  assert.equal(interpretConfirmationLocation('?client=preview&code=unhandled',''),'unavailable');
  assert.equal(interpretConfirmationLocation('?client=preview','#access_token=fixture&type=recovery'),'recover');
});

it('sends signup, resend and recovery through the real Auth adapter with Preview redirect parameters',async()=>{
  process.env.EXPO_PUBLIC_APP_CLIENT='preview';
  process.env.EXPO_PUBLIC_SUPABASE_URL='https://zqfxnzwtptepulmgpxhb.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='public-fixture';
  delete process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL;
  const calls:URL[]=[];
  globalThis.fetch=async(input)=>{calls.push(new URL(String(input)));return Response.json({});};
  const auth=new SupabaseCloudAuth();
  await auth.signUp('demo@example.com','secret1');
  await auth.resendSignupConfirmation('demo@example.com');
  await auth.recoverPassword('demo@example.com');
  assert.equal(calls.length,3);
  assert.deepEqual(calls.map(url=>url.pathname),['/auth/v1/signup','/auth/v1/resend','/auth/v1/recover']);
  for(const call of calls){
    const redirect=new URL(call.searchParams.get('redirect_to')!);
    assert.equal(redirect.origin,'https://sparkly-paprenjak-65f499.netlify.app');
    assert.equal(redirect.searchParams.get('client'),'preview');
    assert.ok(['fr','en'].includes(redirect.searchParams.get('lang')!));
    assert.doesNotMatch(redirect.toString(),/secret1|access_token|refresh_token/);
  }
});
