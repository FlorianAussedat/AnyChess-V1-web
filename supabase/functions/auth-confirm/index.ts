import { renderConfirmationPage } from './page.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

Deno.serve(() =>
  new Response(renderConfirmationPage({ supabaseUrl: url, anonKey: anon }), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  }),
);
