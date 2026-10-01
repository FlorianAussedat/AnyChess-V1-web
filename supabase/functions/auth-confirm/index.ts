import { PLAIN_FALLBACK } from './outcome.ts';

// Hosted *.supabase.co rewrites text/html to text/plain and sandboxes the response,
// so this URL stays readable text. The conditional page (signup check and
// password form) is renderConfirmationPage, served as text/html by the web host
// at GET /auth/confirm — not by this function.
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
