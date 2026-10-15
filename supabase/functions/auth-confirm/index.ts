import { languageFromAccept, plainFallback } from './outcome.ts';

// Hosted *.supabase.co rewrites text/html to text/plain and sandboxes the response.
// This URL stays readable text. The conditional page is renderConfirmationPage,
// served as text/html by the web host at GET /auth/confirm.
// The fragment token is not sent here, so this response never says the address
// is confirmed.
Deno.serve((request) => {
  const language = languageFromAccept(request.headers.get('accept-language'));
  return new Response(plainFallback(language), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    },
  });
});
