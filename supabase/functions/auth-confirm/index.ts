import { languageFromAccept, plainFallback, userEmailIsConfirmed } from './outcome.ts';
import {
  PUBLIC_CONFIRM_PAGE_URL,
  PUBLIC_SUPABASE_URL,
  allowedConfirmOrigin,
  confirmPageRedirect,
} from './publicPage.ts';

function corsHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  const origin = allowedConfirmOrigin(request.headers.get('origin'));
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(payload: unknown, status: number, request: Request): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function proxyResult(
  request: Request,
  ok: boolean,
  status: number,
  confirmed: boolean,
  body: unknown,
  httpStatus = status,
): Response {
  return json({ proxy: true, ok, status, confirmed, body }, httpStatus, request);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method === 'POST') {
    return proxyAuth(request);
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    const location = confirmPageRedirect(request.url, PUBLIC_CONFIRM_PAGE_URL);
    return new Response(request.method === 'HEAD' ? null : plainFallback(languageFromAccept(request.headers.get('accept-language'))), {
      status: 302,
      headers: {
        Location: location,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, POST, OPTIONS' } });
});

async function proxyAuth(request: Request): Promise<Response> {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || PUBLIC_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!anonKey) {
    return proxyResult(request, false, 503, false, null, 503);
  }

  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return proxyResult(request, false, 400, false, null, 400);
  }
  if (raw.length > 16000) return proxyResult(request, false, 400, false, null, 400);

  let body: { action?: unknown; access_token?: unknown; password?: unknown };
  try {
    body = JSON.parse(raw) as { action?: unknown; access_token?: unknown; password?: unknown };
  } catch {
    return proxyResult(request, false, 400, false, null, 400);
  }

  const token = typeof body.access_token === 'string' ? body.access_token : '';
  if (!token || token.length > 8192) return proxyResult(request, false, 400, false, null, 400);

  if (body.action === 'verify') {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      });
      const payload = await response.json().catch(() => null);
      if (response.status >= 500) return proxyResult(request, false, response.status, false, null, 503);
      const confirmed = response.ok && userEmailIsConfirmed(payload);
      const stamp =
        payload && typeof payload === 'object'
          ? (payload as { email_confirmed_at?: unknown; user?: { email_confirmed_at?: unknown } }).email_confirmed_at ||
            (payload as { user?: { email_confirmed_at?: unknown } }).user?.email_confirmed_at
          : null;
      return proxyResult(request, 
        response.ok,
        response.status,
        confirmed,
        confirmed && typeof stamp === 'string' ? { email_confirmed_at: stamp } : null,
        200,
      );
    } catch {
      return proxyResult(request, false, 503, false, null, 503);
    }
  }

  if (body.action === 'recover') {
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 6 || password.length > 128) return proxyResult(request, false, 422, false, null, 422);
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      if (response.status >= 500) return proxyResult(request, false, response.status, false, null, 503);
      return proxyResult(request, response.ok, response.status, false, null, response.ok ? 200 : response.status);
    } catch {
      return proxyResult(request, false, 503, false, null, 503);
    }
  }

  return proxyResult(request, false, 400, false, null, 400);
}
