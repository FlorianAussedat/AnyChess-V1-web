import { PLAIN_FALLBACK } from './outcome.ts';

// Hosted *.supabase.co rewrites text/html to text/plain and sandboxes the response,
// so this URL stays readable text. The conditional page is renderConfirmationPage.
Deno.serve(() =>
  new Response(PLAIN_FALLBACK, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  }),
);
