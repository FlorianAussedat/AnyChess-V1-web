/** Two-letter mark shown when the account has no photo. */
export function initialsFromUsername(username: string | null | undefined): string {
  const trimmed = username?.trim() ?? '';
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const raw =
    parts.length >= 2
      ? `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`
      : trimmed.slice(0, 2);
  return raw.toLocaleUpperCase();
}
