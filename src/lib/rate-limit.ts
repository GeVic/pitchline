/**
 * In-memory sliding-window rate limiter. Per-process, per-key buckets.
 *
 * Trade-offs (for a take-home; would not use in production with horizontal
 * scaling):
 *  - State lives in the Node process. Multiple instances behind a load
 *    balancer would each maintain their own buckets, so the effective
 *    rate limit per IP is N × max where N is the instance count.
 *  - No expiry on inactive keys; the buckets Map grows until restart.
 *    Acceptable for a single-tenant local-dev demo; Redis/Upstash would
 *    own this in production.
 */

const buckets = new Map<string, number[]>();

export type RateLimitOptions = {
  max: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const history = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (history.length >= opts.max) {
    const oldest = history[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + opts.windowMs - now) / 1000),
    );
    buckets.set(key, history);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  history.push(now);
  buckets.set(key, history);
  return {
    allowed: true,
    remaining: opts.max - history.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client identifier. Reads forwarded headers if present
 * (production behind a proxy), otherwise falls back to a constant —
 * meaning all anonymous clients in dev share one bucket, which is fine.
 */
export function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "local";
}
