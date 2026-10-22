/** Bounds transport and body reads even when a fetch implementation ignores abort. */
export const AUTH_TIMEOUT_MS = 20_000;
export class AuthTimeoutError extends Error {
  constructor() {
    super('auth_timeout');
  }
}
export async function authRequest<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs = AUTH_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AuthTimeoutError());
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export function validAuthEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
