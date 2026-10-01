/**
 * AnyChess account deletion — Supabase Edge Function (single file).
 *
 * Deploy as `delete-account`. JWT verification stays enabled.
 * The service role is read from the function environment only.
 * The app sends the user access token plus the password, never an admin key.
 *
 * user_documents rows cascade when the auth user is deleted.
 * Storage objects do not, so this function removes avatars/{userId}/ first.
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64urlToBytes(segment: string): Uint8Array {
  const pad = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyHs256(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as Record<
      string,
      unknown
    >;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "rejected" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anon || !service) return json({ ok: false, error: "unconfigured" }, 500);

  const header = req.headers.get("Authorization") ?? "";
  const accessToken = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!accessToken || accessToken === anon || accessToken === service) {
    return json({ ok: false, error: "reauth_required" }, 401);
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    password = "";
  }
  if (!password) return json({ ok: false, error: "reauth_failed" }, 401);

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
  });
  const userJson = (await userResponse.json().catch(() => ({}))) as {
    id?: string;
    email?: string;
  };

  let userId = userResponse.ok ? userJson.id ?? "" : "";
  let email = userResponse.ok ? userJson.email ?? "" : "";

  if (!userId) {
    const secret = Deno.env.get("SUPABASE_JWT_SECRET") ?? Deno.env.get("JWT_SECRET") ?? "";
    const claims = secret ? await verifyHs256(accessToken, secret) : null;
    const sub = typeof claims?.sub === "string" ? claims.sub : "";
    if (!sub) return json({ ok: false, error: "reauth_required" }, 401);
    const adminUser = await fetch(`${supabaseUrl}/auth/v1/admin/users/${sub}`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
    if (adminUser.status === 404) return json({ ok: true, alreadyDeleted: true });
    return json({ ok: false, error: "reauth_required" }, 401);
  }

  const grant = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const grantJson = (await grant.json().catch(() => ({}))) as {
    user?: { id?: string };
  };
  if (!grant.ok || grantJson.user?.id !== userId) {
    return json({ ok: false, error: "reauth_failed" }, 401);
  }

  const list = await fetch(`${supabaseUrl}/storage/v1/object/list/avatars`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: userId, limit: 100 }),
  });
  const listed = (await list.json().catch(() => [])) as { name?: string }[];
  const names = new Set<string>([`${userId}/avatar.png`]);
  if (Array.isArray(listed)) {
    for (const row of listed) {
      if (row?.name) names.add(`${userId}/${row.name}`);
    }
  }
  if (names.size) {
    await fetch(`${supabaseUrl}/storage/v1/object/avatars`, {
      method: "DELETE",
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(Array.from(names)),
    });
  }

  const removed = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
  if (!removed.ok && removed.status !== 404) {
    return json({ ok: false, error: "failed" }, 502);
  }
  return json({ ok: true, alreadyDeleted: removed.status === 404 });
});
