export const TRANSLATE_MAX_ITEMS = 8;
export const TRANSLATE_MAX_CHARS_PER_ITEM = 500;
export const TRANSLATE_MAX_BODY_CHARS = 8_000;
export const TRANSLATE_REQ_PER_MIN = 15;
export const TRANSLATE_COMMENTS_PER_MIN = 40;
export const TRANSLATE_CHARS_PER_DAY = 20_000;

type MinuteBucket = { startedAt: number; requests: number; comments: number };
type DayBucket = { startedAt: number; chars: number };

const minutes = new Map<string, MinuteBucket>();
const days = new Map<string, DayBucket>();

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; retryAfterMs: number; reason: "rate_limited" };

function minuteBucket(ip: string, now: number): MinuteBucket {
  const current = minutes.get(ip);
  if (!current || now - current.startedAt >= MINUTE_MS) {
    const next = { startedAt: now, requests: 0, comments: 0 };
    minutes.set(ip, next);
    return next;
  }
  return current;
}

function dayBucket(ip: string, now: number): DayBucket {
  const current = days.get(ip);
  if (!current || now - current.startedAt >= DAY_MS) {
    const next = { startedAt: now, chars: 0 };
    days.set(ip, next);
    return next;
  }
  return current;
}

export function inspectTranslateRequestSize(items: { text?: string }[]): {
  itemCount: number;
  chars: number;
  tooLarge: boolean;
} {
  const slice = items.slice(0, TRANSLATE_MAX_ITEMS);
  const chars = slice.reduce((sum, item) => {
    const text = typeof item.text === "string" ? item.text : "";
    return sum + Math.min(text.length, TRANSLATE_MAX_CHARS_PER_ITEM);
  }, 0);
  return {
    itemCount: slice.length,
    chars,
    tooLarge: items.length > TRANSLATE_MAX_ITEMS || chars > TRANSLATE_MAX_BODY_CHARS,
  };
}

export function consumeTranslateQuota(
  ip: string,
  itemCount: number,
  chars: number,
  now = Date.now(),
): RateLimitDecision {
  const minute = minuteBucket(ip, now);
  const day = dayBucket(ip, now);
  if (
    minute.requests + 1 > TRANSLATE_REQ_PER_MIN ||
    minute.comments + itemCount > TRANSLATE_COMMENTS_PER_MIN ||
    day.chars + chars > TRANSLATE_CHARS_PER_DAY
  ) {
    const minuteRetry = MINUTE_MS - (now - minute.startedAt);
    const dayRetry = DAY_MS - (now - day.startedAt);
    const overDay = day.chars + chars > TRANSLATE_CHARS_PER_DAY;
    return {
      ok: false,
      retryAfterMs: Math.max(1_000, overDay ? dayRetry : minuteRetry),
      reason: "rate_limited",
    };
  }
  minute.requests += 1;
  minute.comments += itemCount;
  day.chars += chars;
  return { ok: true };
}

/** Test helper. */
export function resetTranslateRateLimitForTests(): void {
  minutes.clear();
  days.clear();
}
