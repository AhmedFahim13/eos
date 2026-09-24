// lib/ratelimit.ts — sliding-window limiter kept in memory. Per server instance, so it is a
// speed bump for one visitor rather than a hard guarantee; enough to protect free quotas.
const MAX_KEYS = 10_000;

export function createLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  const limiter = (key: string): boolean => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length === 0) hits.delete(key); else hits.set(key, recent);
    if (recent.length >= limit) return false;
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > MAX_KEYS) {
      for (const [k, v] of hits) {
        if (t - v[v.length - 1] >= windowMs) hits.delete(k);
      }
    }
    return true;
  };
  Object.defineProperty(limiter, "size", { get: () => hits.size });
  return limiter as ((key: string) => boolean) & { readonly size: number };
}
