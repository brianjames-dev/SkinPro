type RateLimitEntry = {
  count: number;
  windowStart: number;
  windowMs: number;
};

type RateLimitState = Map<string, RateLimitEntry>;

declare global {
  var __skinproRateLimit: RateLimitState | undefined;
}

const getRateLimitState = () => {
  if (!globalThis.__skinproRateLimit) {
    globalThis.__skinproRateLimit = new Map();
  }
  return globalThis.__skinproRateLimit;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number; limit: number; windowMs: number };

export const checkRateLimit = (
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult => {
  const store = getRateLimitState();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now, windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    const retryAfterMs = Math.max(0, windowMs - (now - entry.windowStart));
    return {
      ok: false,
      retryAfter: Math.ceil(retryAfterMs / 1000),
      limit,
      windowMs
    };
  }

  entry.count += 1;
  return { ok: true };
};

export const checkRateLimits = (
  keyBase: string,
  limits: Array<{ limit: number; windowMs: number; label: string }>
): RateLimitResult => {
  for (const limit of limits) {
    const result = checkRateLimit(
      `${keyBase}:${limit.label}`,
      limit.limit,
      limit.windowMs
    );
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
};
