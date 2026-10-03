import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { rootCertificates } from 'node:tls';
import { isOfficialUrl } from '../lib/domains.ts';
import { EXTRA_INTERMEDIATES } from './certs.ts';
import { redisFromEnv, type RedisLike } from './redis-limit.ts';

export type Verdict = { ok: boolean; reason: string };

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 5;
const SNIFF_BYTES = 16_384;
const CONCURRENCY = 4;
// Per answer: at most this many uncached outbound checks, and at most this long spent waiting on them.
export const MAX_CHECKS_PER_ANSWER = 12;
export const CHECK_BUDGET_MS = 20_000;
const DAY_S = 24 * 60 * 60;
// Timeouts, network and TLS errors may be transient or fixed by a new vendored intermediate, so they expire sooner.
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

// Loopback, private, link-local (cloud metadata), CGNAT, multicast and unspecified ranges.
const BLOCKED = new BlockList();
for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]] as const) {
  BLOCKED.addSubnet(net, bits, 'ipv4');
}
for (const [net, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96]] as const) {
  BLOCKED.addSubnet(net, bits, 'ipv6');
}

/** True for any address a server-side fetch must never reach. */
export function isBlockedIp(ip: string) {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  const addr = mapped ? mapped[1] : ip;
  const family = isIP(addr);
  if (!family) return true;
  return BLOCKED.check(addr, family === 4 ? 'ipv4' : 'ipv6');
}

export type Resolved = { address: string; family: 4 | 6 };
export type Hop = { status: number; headers: IncomingHttpHeaders; body: string };
export type ProbeDeps = {
  resolve(host: string): Promise<Resolved[]>;
  /** One request to `url`, connected to exactly `ip`, reading at most `maxBytes` of the body. */
  get(url: URL, ip: Resolved, signal: AbortSignal, maxBytes: number): Promise<Hop>;
};

// TLS stays verified. The extra intermediates only complete chains that sites forget to send.
export const TLS_OPTIONS: { rejectUnauthorized: true; ca: string[] } = { rejectUnauthorized: true, ca: [...rootCertificates, ...EXTRA_INTERMEDIATES] };

const HEADERS = {
  'user-agent': UA,
  accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
  'accept-language': 'en-IN,en;q=0.9',
};

const nodeDeps: ProbeDeps = {
  async resolve(host) {
    return (await lookup(host, { all: true, verbatim: true })) as Resolved[];
  },
  get(url, ip, signal, maxBytes) {
    return new Promise((resolve, reject) => {
      const secure = url.protocol === 'https:';
      const req = (secure ? httpsRequest : httpRequest)(
        url,
        {
          method: 'GET',
          headers: HEADERS,
          signal,
          agent: false,
          // Connect to the address that was checked, so DNS cannot change between check and connect.
          lookup: (_h, opts, cb) => ((opts as { all?: boolean }).all ? cb(null, [ip] as never) : cb(null, ip.address, ip.family)),
          ...(secure ? { ...TLS_OPTIONS, servername: url.hostname } : {}),
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            res.destroy();
            return resolve({ status, headers: res.headers, body: '' });
          }
          const chunks: Buffer[] = [];
          let size = 0;
          const finish = () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8') });
          res.on('data', (c: Buffer) => {
            chunks.push(c);
            size += c.length;
            if (size >= maxBytes) {
              res.destroy();
              finish();
            }
          });
          res.on('end', finish);
          res.on('error', () => finish());
        },
      );
      req.on('error', reject);
      req.end();
    });
  },
};

const TLS_ERROR = /CERT|SSL|TLS|EPROTO|UNABLE_TO|SELF_SIGNED|RENEGOTIATION/;

/**
 * GETs a cited URL like a browser would, guarding against SSRF: https on default ports only (http only
 * as an immediate redirect to https), allow-listed hosts, public IPs checked and pinned on every hop.
 */
export async function probe(url: string, deps: ProbeDeps = nodeDeps, timeoutMs = TIMEOUT_MS): Promise<Verdict> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return { ok: false, reason: 'bad url' };
  }
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isOfficialUrl(current.toString())) return { ok: false, reason: hop ? 'redirect off allow-list' : 'not official' };
      if (current.protocol !== 'https:' && current.protocol !== 'http:') return { ok: false, reason: 'bad scheme' };
      if (current.port !== '' || current.username || current.password) return { ok: false, reason: 'non-default port or credentials' };
      const addrs = await deps.resolve(current.hostname);
      if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) return { ok: false, reason: 'blocked address' };
      const res = await deps.get(current, addrs[0], signal, SNIFF_BYTES);
      const location = res.headers.location;
      if (res.status >= 300 && res.status < 400 && location) {
        const next = new URL(String(location), current);
        if (current.protocol === 'http:' && next.protocol !== 'https:') return { ok: false, reason: 'insecure http' };
        current = next;
        continue;
      }
      if (current.protocol === 'http:') return { ok: false, reason: 'insecure http' };
      if (res.status < 200 || res.status >= 300) return { ok: false, reason: `http ${res.status}` };
      const type = String(res.headers['content-type'] ?? '');
      if (!/html|text\/plain/i.test(type)) return { ok: true, reason: `http ${res.status}` };
      return isSoft404(res.body) ? { ok: false, reason: 'soft 404' } : { ok: true, reason: `http ${res.status}` };
    }
    return { ok: false, reason: 'too many redirects' };
  } catch (err) {
    const name = (err as Error)?.name;
    if (signal.aborted || name === 'TimeoutError' || name === 'AbortError') return { ok: false, reason: 'timeout' };
    const code = String((err as { code?: string })?.code ?? '');
    return { ok: false, reason: TLS_ERROR.test(code) ? 'tls error' : 'network error' };
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

type CheckerOptions = { concurrency?: number; maxChecks?: number; budgetMs?: number };

export function createLinkChecker(cache: CacheStore, check: (url: string) => Promise<Verdict> = (u) => probe(u), opts: CheckerOptions = {}) {
  const { concurrency = CONCURRENCY, maxChecks = MAX_CHECKS_PER_ANSWER, budgetMs = CHECK_BUDGET_MS } = opts;
  let waited = 0;
  const inflight = new Map<string, Promise<Verdict>>();
  let checks = 0;
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
    // Over budget means unverified, never trusted, and is not cached.
    if (++checks > maxChecks) return { ok: false, reason: 'link budget' };
    await slot();
    if (waited >= budgetMs) {
      release();
      return { ok: false, reason: 'deadline' };
    }
    try {
      const v = await check(url);
      const flaky = v.reason === 'timeout' || v.reason === 'network error' || v.reason === 'tls error';
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
    /** Verdicts for every URL; any still pending when the answer's wait budget runs out count as failed. */
    async verifyAll(urls: string[]) {
      const out = new Map<string, Verdict>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const started = Date.now();
      const late = new Promise<void>((r) => (timer = setTimeout(r, Math.max(0, budgetMs - waited))));
      await Promise.race([Promise.all([...new Set(urls)].map(async (u) => out.set(u, await this.verify(u)))), late]);
      clearTimeout(timer);
      waited += Date.now() - started;
      for (const u of new Set(urls)) if (!out.has(u)) out.set(u, { ok: false, reason: 'deadline' });
      return out;
    },
    checks: () => checks,
  };
}

const redis = redisFromEnv();
const sharedCache = redis ? redisCache(redis) : memoryCache();

/** One checker per request so in-flight dedupe never outlives it; verdicts are shared through the cache. */
export const linkChecker = () => createLinkChecker(sharedCache);
