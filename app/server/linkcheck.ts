import { constants, createHash } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { Readable } from 'node:stream';
import { hostOf, isOfficialUrl } from '../lib/domains.ts';
import { redisFromEnv, type RedisLike } from './redis-limit.ts';

export type Verdict = { ok: boolean; reason: string };

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 5;
const SNIFF_BYTES = 16_384;
const CONCURRENCY = 4;
const DAY_S = 24 * 60 * 60;
// Timeouts and network errors are often transient, so they are retried sooner.
const FLAKY_S = 60 * 60;

const NOT_FOUND_TITLE = /\b404\b|not\s+found|page\s+(does\s+not|doesn'?t)\s+exist|no\s+longer\s+available|error\s+page/i;
const NOT_FOUND_BODY = /page\s+not\s+found|404\s*[-:|]?\s*not\s+found|error\s+404|requested\s+(page|url|resource)\s+(was\s+not|could\s+not\s+be|cannot\s+be)\s+found|page\s+you\s+are\s+looking\s+for\s+(does\s+not|doesn'?t|could\s+not|cannot)/i;

/** A 200 page that is really a "not found" page, judged from its title and first KB of text. */
export function isSoft404(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  if (title && NOT_FOUND_TITLE.test(title)) return true;
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 1024);
  return NOT_FOUND_BODY.test(text);
}

async function readHead(res: Response, max: number) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < max) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks).subarray(0, max));
}

const TLS_CHAIN = /UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT|UNSAFE_LEGACY_RENEGOTIATION|SELF_SIGNED_CERT_IN_CHAIN/;

// Browsers fetch missing intermediate certificates and some gov.in hosts rely on that,
// so a TLS chain error is retried without chain checks. Only allow-listed hosts reach here.
const lenientFetch: typeof fetch = (input, init) =>
  new Promise((resolve, reject) => {
    const u = new URL(String(input));
    const req = (u.protocol === 'http:' ? httpRequest : httpsRequest)(
      u,
      {
        method: 'GET',
        headers: init?.headers as Record<string, string>,
        signal: init?.signal ?? undefined,
        rejectUnauthorized: false,
        secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
      },
      (res) => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) for (const item of [v ?? []].flat()) headers.append(k, String(item));
        const status = res.statusCode ?? 0;
        const body = status >= 200 && status !== 204 && status !== 304 ? (Readable.toWeb(res) as ReadableStream) : (res.resume(), null);
        resolve(new Response(body, { status: status < 200 || status > 599 ? 599 : status, headers }));
      },
    );
    req.on('error', reject);
    req.end();
  });

/** GETs the URL like a browser, following up to 5 redirects that must stay on official hosts. */
export async function probe(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = TIMEOUT_MS): Promise<Verdict> {
  const first = await probeWith(url, fetchImpl, timeoutMs);
  return first.reason === 'tls chain' && fetchImpl === fetch ? probeWith(url, lenientFetch, timeoutMs) : first;
}

async function probeWith(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Verdict> {
  if (!isOfficialUrl(url)) return { ok: false, reason: 'not official' };
  const signal = AbortSignal.timeout(timeoutMs);
  const cookies = new Map<string, string>();
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetchImpl(current, {
        redirect: 'manual',
        signal,
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
          'accept-language': 'en-IN,en;q=0.9',
          ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        },
      });
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        await res.body?.cancel().catch(() => {});
        current = new URL(res.headers.get('location')!, current).toString();
        if (!isOfficialUrl(current)) return { ok: false, reason: `redirect to ${hostOf(current) ?? 'unknown host'}` };
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        await res.body?.cancel().catch(() => {});
        return { ok: false, reason: `http ${res.status}` };
      }
      const type = res.headers.get('content-type') ?? '';
      if (!/html|text\/plain/i.test(type)) {
        await res.body?.cancel().catch(() => {});
        return { ok: true, reason: `http ${res.status}` };
      }
      const head = await readHead(res, SNIFF_BYTES);
      return isSoft404(head) ? { ok: false, reason: 'soft 404' } : { ok: true, reason: `http ${res.status}` };
    }
    return { ok: false, reason: 'too many redirects' };
  } catch (err) {
    const name = (err as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') return { ok: false, reason: 'timeout' };
    const code = String((err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code ?? '');
    return { ok: false, reason: TLS_CHAIN.test(code) ? 'tls chain' : 'network error' };
  }
}

const GET_SCRIPT = `return redis.call('GET', KEYS[1])`;
const SET_SCRIPT = `return redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])`;
export const LINKCHECK_SCRIPTS = { GET_SCRIPT, SET_SCRIPT };

type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlS: number): Promise<void>;
};

export function memoryCache(maxEntries = 5000, now = () => Date.now()): CacheStore {
  const entries = new Map<string, { value: string; until: number }>();
  return {
    async get(key) {
      const e = entries.get(key);
      if (!e) return null;
      if (e.until <= now()) {
        entries.delete(key);
        return null;
      }
      return e.value;
    },
    async set(key, value, ttlS) {
      entries.delete(key);
      entries.set(key, { value, until: now() + ttlS * 1000 });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    },
  };
}

/** Verdicts in Redis; a Redis error just means the link is checked again, never that it is trusted. */
export function redisCache(redis: RedisLike): CacheStore {
  return {
    async get(key) {
      try {
        const v = await redis.eval(GET_SCRIPT, [key], []);
        return v === null || v === undefined ? null : String(v);
      } catch {
        return null;
      }
    },
    async set(key, value, ttlS) {
      await redis.eval(SET_SCRIPT, [key], [value, ttlS]).catch(() => {});
    },
  };
}

export const cacheKeyFor = (url: string) => `linkcheck:${createHash('sha1').update(url).digest('hex')}`;

export function createLinkChecker(cache: CacheStore, check: (url: string) => Promise<Verdict> = (u) => probe(u), concurrency = CONCURRENCY) {
  const inflight = new Map<string, Promise<Verdict>>();
  let active = 0;
  const queue: (() => void)[] = [];
  const slot = () => (active < concurrency ? (active++, Promise.resolve()) : new Promise<void>((r) => queue.push(r)));
  // A freed slot passes straight to the next waiter, so `active` never overshoots.
  const release = () => {
    const next = queue.shift();
    if (next) next();
    else active--;
  };

  async function run(url: string): Promise<Verdict> {
    const key = cacheKeyFor(url);
    const cached = await cache.get(key);
    if (cached) return { ok: cached.startsWith('ok'), reason: `${cached.slice(cached.indexOf(':') + 1)} (cached)` };
    await slot();
    try {
      const v = await check(url);
      const flaky = v.reason === 'timeout' || v.reason === 'network error';
      await cache.set(key, `${v.ok ? 'ok' : 'bad'}:${v.reason}`, flaky ? FLAKY_S : DAY_S);
      return v;
    } finally {
      release();
    }
  }

  return {
    /** Starts a check early (e.g. while the answer streams); repeated calls share one result. */
    verify(url: string) {
      let p = inflight.get(url);
      if (!p) {
        p = run(url);
        inflight.set(url, p);
      }
      return p;
    },
    async verifyAll(urls: string[]) {
      const out = new Map<string, Verdict>();
      await Promise.all([...new Set(urls)].map(async (u) => out.set(u, await this.verify(u))));
      return out;
    },
  };
}

const redis = redisFromEnv();
const sharedCache = redis ? redisCache(redis) : memoryCache();

/** One checker per request so in-flight dedupe never outlives it; verdicts are shared through the cache. */
export const linkChecker = () => createLinkChecker(sharedCache);
