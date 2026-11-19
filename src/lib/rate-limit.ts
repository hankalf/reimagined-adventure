/**
 * Small in-memory sliding-window rate limiter. Suitable for a single Railway instance; if the app is ever
 * scaled horizontally, swap the store for Redis/Postgres.
 */
type Bucket = { hits: number[] };

const store: Map<string, Bucket> = ((globalThis as unknown as { __gpRateLimit?: Map<string, Bucket> }).__gpRateLimit ??=
  new Map());

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    store.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  if (store.size > 10_000) {
    for (const [k, b] of store) if (b.hits.every((t) => now - t >= windowMs)) store.delete(k);
  }
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}
