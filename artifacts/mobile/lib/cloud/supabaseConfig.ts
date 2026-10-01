function readPublic(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/** Public project URL — not a secret. DeepL key must never be read here. */
export function resolveSupabaseUrl(): string | null {
  return (
    readPublic(process.env.EXPO_PUBLIC_SUPABASE_URL) ??
    readPublic(process.env.ANYCHESS_SUPABASE_URL)
  );
}

/** Anon key is designed for clients and is gated by RLS. Not the service role. */
export function resolveSupabaseAnonKey(): string | null {
  return (
    readPublic(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ??
    readPublic(process.env.ANYCHESS_SUPABASE_ANON_KEY)
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseAnonKey());
}

export function assertNoDeepLKeyInCloudConfig(): boolean {
  const url = resolveSupabaseUrl() ?? '';
  const anon = resolveSupabaseAnonKey() ?? '';
  return !/deepl|api-free\.deepl/i.test(`${url}${anon}`);
}
