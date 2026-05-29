// Sliding-window in-memory rate limiter.
// Works for single-instance deployments. For multi-instance/serverless use Upstash Redis.

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Removes expired entries from the store. Extracted so it can be tested
// directly (the setInterval callback never fires under fake timers).
export function pruneExpiredEntries(now = Date.now()): void {
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key);
  });
}

// Prune expired entries every 5 minutes to prevent memory leaks
setInterval(() => pruneExpiredEntries(), 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
