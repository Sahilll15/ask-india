import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepVerified, shownUrls } from '../app/lib/citations.ts';
import { bestPortal } from '../app/lib/directory.ts';
import { isOfficialUrl, isPreviewHost } from '../app/lib/domains.ts';
import { cacheKeyFor, createLinkChecker, isSoft404, LINKCHECK_SCRIPTS, memoryCache, probe, redisCache } from '../app/server/linkcheck.ts';
import type { RedisLike } from '../app/server/redis-limit.ts';

const src = (n: number, url: string) => ({ n, url, title: `T${n}`, domain: new URL(url).hostname });

test('renumbers kept sources and rewrites markers, dropping markers of dead links', () => {
  const sources = [src(1, 'https://uidai.gov.in/dead'), src(2, 'https://myaadhaar.uidai.gov.in/'), src(3, 'https://gst.kar.nic.in/x.pdf')];
  const text = 'Use myAadhaar [2]. Old FAQ [1].\n\n1. Log in [2] [1]\n2. Upload proof [3].';
  const ok = new Set(['https://myaadhaar.uidai.gov.in/']);
  const r = keepVerified(text, sources, (u) => ok.has(u));
  assert.equal(r.text, 'Use myAadhaar [1]. Old FAQ.\n\n1. Log in [1]\n2. Upload proof.');
  assert.deepEqual(r.sources.map((s) => [s.n, s.url]), [[1, 'https://myaadhaar.uidai.gov.in/']]);
});

test('keeps order and collapses repeated markers after renumbering', () => {
  const sources = [src(1, 'https://a.gov.in/'), src(2, 'https://b.gov.in/'), src(3, 'https://c.gov.in/')];
  const r = keepVerified('A [1] [2]. B [3] [3].', sources, (u) => u !== 'https://b.gov.in/');
  assert.equal(r.text, 'A [1]. B [2].');
  assert.deepEqual(r.sources.map((s) => s.n), [1, 2]);
});

test('inline official links are checked too and unwrapped when dead', () => {
  const text = 'See [the form](https://parivahan.gov.in/forms) and [Sarathi](https://sarathi.parivahan.gov.in/) [1].';
  const sources = [src(1, 'https://sarathi.parivahan.gov.in/')];
  assert.deepEqual(shownUrls(text, sources), ['https://sarathi.parivahan.gov.in/', 'https://parivahan.gov.in/forms']);
  const r = keepVerified(text, sources, (u) => u === 'https://sarathi.parivahan.gov.in/');
  assert.equal(r.text, 'See the form and [Sarathi](https://sarathi.parivahan.gov.in/) [1].');
});

test('soft 404 pages are detected from the title or the first KB of text', () => {
  assert.ok(isSoft404('<html><head><title>404 - Page Not Found | UIDAI</title></head><body>x</body></html>'));
  assert.ok(isSoft404('<html><head><title>Parivahan</title></head><body><h1>Oops! Page not found</h1></body></html>'));
  assert.ok(isSoft404('<body><p>The requested URL was not found on this server.</p></body>'));
  assert.ok(!isSoft404('<html><head><title>Update Aadhaar | UIDAI</title></head><body>Fee is Rs 50. Call 1947 or 404 offices.</body></html>'));
  assert.ok(!isSoft404('<title>GST registration</title><body>Form REG-01</body>'));
});

test('staging, test, uat, dev, demo and beta hosts are not official', () => {
  for (const h of ['staging.parivahan.nic.in', 'uat.gst.gov.in', 'test-portal.uidai.gov.in', 'dev2.incometax.gov.in', 'demo.nha.gov.in', 'beta.india.gov.in']) {
    assert.ok(isPreviewHost(h), h);
    assert.ok(!isOfficialUrl(`https://${h}/x`), h);
  }
  for (const h of ['sarathi.parivahan.gov.in', 'services.ecourts.gov.in', 'testmyaadhaar.gov.in', 'devanagari.gov.in']) assert.ok(!isPreviewHost(h), h);
});

const page = (status: number, body = '', headers: Record<string, string> = {}) =>
  new Response(status === 204 || status === 304 ? null : body, { status, headers: { 'content-type': 'text/html', ...headers } });

test('probe follows redirects on official hosts and refuses ones that leave them', async () => {
  const routes: Record<string, Response | (() => Response)> = {
    'https://uidai.gov.in/old': () => page(301, '', { location: '/new' }),
    'https://uidai.gov.in/new': () => page(200, '<title>Update address</title>'),
    'https://gst.gov.in/away': () => page(302, '', { location: 'https://evil.example.com/' }),
    'https://gst.gov.in/gone': () => page(404, 'nope'),
    'https://gst.gov.in/soft': () => page(200, '<title>Page not found</title>'),
    'https://gst.gov.in/pdf': () => page(200, '%PDF-1.4', { 'content-type': 'application/pdf' }),
  };
  const fake = (async (u: string | URL | Request) => {
    const r = routes[String(u)];
    if (!r) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    return typeof r === 'function' ? r() : r;
  }) as typeof fetch;
  assert.deepEqual(await probe('https://uidai.gov.in/old', fake), { ok: true, reason: 'http 200' });
  assert.equal((await probe('https://gst.gov.in/away', fake)).ok, false);
  assert.deepEqual(await probe('https://gst.gov.in/gone', fake), { ok: false, reason: 'http 404' });
  assert.deepEqual(await probe('https://gst.gov.in/soft', fake), { ok: false, reason: 'soft 404' });
  assert.equal((await probe('https://gst.gov.in/pdf', fake)).ok, true);
  assert.deepEqual(await probe('https://gst.gov.in/missing', fake), { ok: false, reason: 'network error' });
  assert.deepEqual(await probe('https://staging.parivahan.nic.in/', fake), { ok: false, reason: 'not official' });
});

test('probe times out slow hosts', async () => {
  // AbortSignal.timeout does not hold the event loop open, so the fake keeps a timer alive.
  const hang = ((_u: unknown, init?: RequestInit) =>
    new Promise((_r, reject) => {
      const keep = setTimeout(() => {}, 5000);
      init?.signal?.addEventListener('abort', () => (clearTimeout(keep), reject(init.signal!.reason)));
    })) as typeof fetch;
  assert.deepEqual(await probe('https://texmin.nic.in/a.pdf', hang, 50), { ok: false, reason: 'timeout' });
});

test('verdicts are cached, deduped in flight and checked with a concurrency cap', async () => {
  let calls = 0;
  let active = 0;
  let peak = 0;
  const check = async (url: string) => {
    calls++;
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return { ok: !url.includes('dead'), reason: url.includes('dead') ? 'http 404' : 'http 200' };
  };
  const cache = memoryCache();
  const urls = Array.from({ length: 10 }, (_, i) => `https://a.gov.in/${i}${i === 3 ? 'dead' : ''}`);
  const first = await createLinkChecker(cache, check, 3).verifyAll([...urls, urls[0]]);
  assert.equal(calls, 10);
  assert.ok(peak <= 3, `peak ${peak}`);
  assert.equal(first.get(urls[3])!.ok, false);
  const again = await createLinkChecker(cache, check, 3).verifyAll(urls);
  assert.equal(calls, 10, 'second request is served from the cache');
  assert.equal(again.get(urls[3])!.ok, false);
  assert.equal(again.get(urls[0])!.ok, true);
});

test('memory cache expires after its TTL', async () => {
  let now = 0;
  const c = memoryCache(10, () => now);
  await c.set('k', 'ok:http 200', 60);
  assert.equal(await c.get('k'), 'ok:http 200');
  now = 60_000;
  assert.equal(await c.get('k'), null);
});

test('redis cache uses linkcheck:<sha1> keys with a 24h TTL and degrades to a miss on errors', async () => {
  const seen: unknown[] = [];
  const store = new Map<string, string>();
  const redis: RedisLike = {
    async eval(script, [key], args) {
      seen.push([script === LINKCHECK_SCRIPTS.SET_SCRIPT ? 'SET' : 'GET', key, ...args]);
      if (script === LINKCHECK_SCRIPTS.SET_SCRIPT) store.set(key, String(args[0]));
      return store.get(key) ?? null;
    },
  };
  const checker = createLinkChecker(redisCache(redis), async () => ({ ok: true, reason: 'http 200' }));
  await checker.verify('https://gst.gov.in/');
  const key = cacheKeyFor('https://gst.gov.in/');
  assert.match(key, /^linkcheck:[0-9a-f]{40}$/);
  assert.deepEqual(seen.at(-1), ['SET', key, 'ok:http 200', 86400]);
  const broken = redisCache({ eval: async () => Promise.reject(new Error('down')) });
  assert.equal(await broken.get(key), null);
  await broken.set(key, 'ok', 1);
});

test('best portal follows the topic of the question', () => {
  assert.equal(bestPortal('How do I update my address in Aadhaar online?').name, 'myAadhaar');
  assert.equal(bestPortal('Driving licence renew kaise karein online?').name, 'Sarathi');
  assert.equal(bestPortal('How do I register for GST?').name, 'GST portal');
  assert.equal(bestPortal('आयुष्मान कार्ड कैसे बनवाएं?').name, 'Ayushman Bharat beneficiary portal');
  assert.equal(bestPortal('How do I renew my passport?').name, 'Passport Seva');
  assert.equal(bestPortal('How do I link my PAN with Aadhaar?').name, 'Income Tax e-filing');
  assert.equal(bestPortal('What should I do?', 'Use the Udyam portal.').name, 'Udyam Registration');
  assert.equal(bestPortal('something unrelated').name, 'National Portal of India');
});
