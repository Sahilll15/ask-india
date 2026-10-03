import { createRedisBudget, createRedisWindow, LimiterUnavailable, limiterBusy, redisFromEnv } from './redis-limit.ts';

const HOUR = 60 * 60 * 1000;
const SWEEP_EVERY = 60_000;

export type Limit = { limit: number; windowMs: number };
export type Verdict = { ok: true; remaining: number } | { ok: false; retryAfter: number };

/** Reads a non-negative integer env var. Anything malformed falls back to the default instead of disabling the limit. */
export function envInt(raw: string | undefined, fallback: number, min = 0) {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== '' && Number.isInteger(n) && n >= min ? n : fallback;
}

const windowMs = envInt(process.env.RATE_LIMIT_WINDOW_MS, HOUR, 1000);

export const LIMITS = {
  question: { limit: envInt(process.env.RATE_LIMIT_QUESTIONS, 8), windowMs },
  transcribe: { limit: envInt(process.env.RATE_LIMIT_TRANSCRIBES, 6), windowMs },
  feedback: { limit: envInt(process.env.RATE_LIMIT_FEEDBACK, 30), windowMs },
} satisfies Record<string, Limit>;

/** Canonical key for an address: ports, zones and brackets stripped, IPv6 grouped by /64. */
export function normalizeIp(raw: string) {
  let ip = raw.trim().toLowerCase();
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  ip = ip.replace(/%.*$/, '');

  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) ip = mapped[1];

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return ip.split('.').every((o) => Number(o) <= 255) ? ip.split('.').map(Number).join('.') : 'invalid';
  }
  if (!ip.includes(':') || !/^[0-9a-f:]+$/.test(ip)) return 'invalid';

  const halves = ip.split('::');
  if (halves.length > 2) return 'invalid';
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return 'invalid';
  const groups = [...head, ...Array(missing).fill('0'), ...tail];
  if (groups.some((g) => g.length === 0 || g.length > 4)) return 'invalid';
  // One subscriber usually owns a whole /64, so finer keys would let them rotate addresses.
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

// x-real-ip is overwritten by the platform proxy (Vercel). The leftmost x-forwarded-for
// entry is whatever the client sent, so only the last hop is used.
export function clientIp(req: Request) {
  const real = req.headers.get('x-real-ip');
  if (real?.trim()) return normalizeIp(real);
  const last = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
  return last ? normalizeIp(last) : 'unknown';
}

type Entry = { hits: number[]; windowMs: number };

export function createLimiter(maxKeys = 10_000) {
  const buckets = new Map<string, Entry>();
  let lastSweep = 0;

  function sweep(now: number) {
    lastSweep = now;
    for (const [key, e] of buckets) {
      if (!e.hits.length || now - e.hits[e.hits.length - 1] >= e.windowMs) buckets.delete(key);
    }
  }

  function store(key: string, entry: Entry, now: number) {
    buckets.delete(key);
    buckets.set(key, entry);
    if (buckets.size <= maxKeys) return;
    if (now - lastSweep > SWEEP_EVERY) sweep(now);
    // Evict least recently touched keys one at a time; never wipe everyone's counters.
    while (buckets.size > maxKeys) buckets.delete(buckets.keys().next().value!);
  }

  function live(key: string, windowMs: number, now: number) {
    return (buckets.get(key)?.hits ?? []).filter((t) => now - t < windowMs);
  }

  const retryAfter = (hits: number[], windowMs: number, now: number) =>
    Math.max(1, Math.ceil(((hits[0] ?? now) + windowMs - now) / 1000));

  return {
    hit(key: string, { limit, windowMs }: Limit, now = Date.now()): Verdict {
      const hits = live(key, windowMs, now);
      if (hits.length >= limit) {
        store(key, { hits, windowMs }, now);
        return { ok: false, retryAfter: retryAfter(hits, windowMs, now) };
      }
      hits.push(now);
      store(key, { hits, windowMs }, now);
      return { ok: true, remaining: limit - hits.length };
    },
    /** Seconds until the key may try again, or 0 when it is not limited. Does not count a hit. */
    blocked(key: string, { limit, windowMs }: Limit, now = Date.now()) {
      const hits = live(key, windowMs, now);
      return hits.length >= limit ? retryAfter(hits, windowMs, now) : 0;
    },
    /** Remaining hits and when the oldest one expires. Does not count a hit. */
    peek(key: string, { limit, windowMs }: Limit, now = Date.now()) {
      const hits = live(key, windowMs, now);
      return { remaining: Math.max(0, limit - hits.length), resetAt: hits.length ? hits[0] + windowMs : null };
    },
    size: () => buckets.size,
  };
}

/** An in-memory counter that resets at UTC midnight (fallback when Redis is not configured). */
export function createDailyBudget(limit: number, today = () => new Date().toISOString().slice(0, 10)) {
  let day = today();
  let used = 0;
  const roll = () => {
    const d = today();
    if (d !== day) {
      day = d;
      used = 0;
    }
  };
  return {
    take(amount = 1) {
      roll();
      if (used + amount > limit) return false;
      used += amount;
      return true;
    },
    /** Records usage learned after the fact, even past the limit. */
    add(amount: number) {
      roll();
      used += Math.max(0, amount);
    },
    used() {
      roll();
      return used;
    },
  };
}

const limiter = createLimiter();
const redis = redisFromEnv();
const shared = redis ? createRedisWindow(redis, 'ask-india') : null;

/** Counts one hit. Throws LimiterUnavailable when Redis is configured but unreachable. */
export async function check(req: Request, name: keyof typeof LIMITS): Promise<Verdict> {
  const { limit, windowMs } = LIMITS[name];
  if (!shared) return limiter.hit(`${name}:${clientIp(req)}`, LIMITS[name]);
  const now = Date.now();
  const r = await shared.take(name, clientIp(req), limit, windowMs, now);
  return r.ok ? { ok: true, remaining: r.remaining } : { ok: false, retryAfter: Math.max(1, Math.ceil((r.resetAt - now) / 1000)) };
}

export async function isBlocked(req: Request, name: keyof typeof LIMITS) {
  if (!shared) return limiter.blocked(`${name}:${clientIp(req)}`, LIMITS[name]);
  const now = Date.now();
  const p = await shared.peek(name, clientIp(req), LIMITS[name].limit, now);
  return p.remaining === 0 && p.resetAt ? Math.max(1, Math.ceil((p.resetAt - now) / 1000)) : 0;
}

export async function peek(req: Request, name: keyof typeof LIMITS): Promise<{ remaining: number; resetAt: number | null }> {
  if (!shared) return limiter.peek(`${name}:${clientIp(req)}`, LIMITS[name]);
  const { remaining, resetAt } = await shared.peek(name, clientIp(req), LIMITS[name].limit);
  return { remaining, resetAt };
}

export const DAILY_QUESTIONS = envInt(process.env.DAILY_QUESTION_BUDGET, 300);
const localBudget = createDailyBudget(DAILY_QUESTIONS);
const sharedBudget = redis ? createRedisBudget(redis, 'ask-india', 'questions', DAILY_QUESTIONS) : null;

/** Global daily question cap: Redis when configured, otherwise this instance's memory. */
export const questionBudget = {
  take: async (amount = 1) => (sharedBudget ? sharedBudget.take(amount) : localBudget.take(amount)),
  add: async (amount: number) => (sharedBudget ? sharedBudget.add(amount) : localBudget.add(amount)),
  used: async () => (sharedBudget ? sharedBudget.used() : localBudget.used()),
};

export { LimiterUnavailable, limiterBusy };

export function budgetSpent() {
  return Response.json(
    { error: 'Ask India has used up its question budget for today. Try again tomorrow.', code: 'daily_budget' },
    { status: 503, headers: { 'retry-after': '3600' } },
  );
}

export function tooMany(retryAfter: number, what: string) {
  const minutes = Math.ceil(retryAfter / 60);
  return Response.json(
    {
      error: `You've reached the hourly limit of ${what}. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      code: 'rate_limited',
      resetAt: Date.now() + retryAfter * 1000,
    },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  );
}
