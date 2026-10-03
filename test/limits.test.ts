import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, createDailyBudget, createLimiter, envInt, normalizeIp } from '../app/server/ratelimit.ts';
import { cacheKey, createAnswerCache } from '../app/server/cache.ts';
import { readJson } from '../app/server/http.ts';
import { detectLang } from '../app/lib/lang.ts';
import { relatedPortals } from '../app/lib/directory.ts';

const HOUR = 3_600_000;
const limit = { limit: 8, windowMs: HOUR };

test('per-IP limiter allows 8 per hour, then blocks with a retry time', () => {
  const l = createLimiter();
  for (let i = 0; i < 8; i++) assert.ok(l.hit('q:1.2.3.4', limit, 1000 + i).ok);
  const v = l.hit('q:1.2.3.4', limit, 2000);
  assert.ok(!v.ok && v.retryAfter === Math.ceil((1000 + HOUR - 2000) / 1000));
  assert.ok(l.hit('q:5.6.7.8', limit, 2000).ok, 'other IPs are unaffected');
  assert.ok(l.hit('q:1.2.3.4', limit, 1000 + HOUR).ok, 'the oldest hit expires after the window');
});

test('peek reports remaining and reset time without spending', () => {
  const l = createLimiter();
  assert.deepEqual(l.peek('k', limit, 0), { remaining: 8, resetAt: null });
  l.hit('k', limit, 500);
  l.hit('k', limit, 900);
  assert.deepEqual(l.peek('k', limit, 1000), { remaining: 6, resetAt: 500 + HOUR });
  assert.deepEqual(l.peek('k', limit, 1000), { remaining: 6, resetAt: 500 + HOUR });
});

test('daily budget caps globally and rolls over at UTC midnight', () => {
  let day = '2026-10-03';
  const b = createDailyBudget(2, () => day);
  assert.ok(b.take() && b.take());
  assert.ok(!b.take());
  day = '2026-10-04';
  assert.ok(b.take());
  assert.equal(b.used(), 1);
});

test('client IP prefers x-real-ip, then the last x-forwarded-for hop', () => {
  const req = (h: Record<string, string>) => new Request('http://x', { headers: h });
  assert.equal(clientIp(req({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })), '9.9.9.9');
  assert.equal(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })), '2.2.2.2');
  assert.equal(normalizeIp('2001:db8:1:2:3:4:5:6'), normalizeIp('2001:db8:1:2:ffff::1'));
  assert.equal(envInt('abc', 8), 8);
  assert.equal(envInt('-1', 8), 8);
  assert.equal(envInt('3', 8), 3);
});

test('readJson maps oversize to 413 and empty to 400', async () => {
  const big = await readJson(new Request('http://x', { method: 'POST', body: 'x'.repeat(20_000) }), 16_000);
  assert.ok(!big.ok && big.res.status === 413);
  const empty = await readJson(new Request('http://x', { method: 'POST', body: '' }), 16_000);
  assert.ok(!empty.ok && empty.res.status === 400);
});

test('answer cache: 12h expiry, bounded size, normalised key', () => {
  const c = createAnswerCache(2, 1000);
  const v = { text: 'a', sources: [], lang: 'en' as const, footer: 'f' };
  c.set('a', v, 0);
  assert.equal(c.get('a', 999), v);
  assert.equal(c.get('a', 1000), null);
  c.set('a', v, 0);
  c.set('b', v, 0);
  c.set('c', v, 0);
  assert.equal(c.size(), 2);
  assert.equal(cacheKey('  How do I get a PAN?? '), cacheKey('how do i  get a pan'));
  assert.equal(cacheKey('पासपोर्ट कैसे बनवाएं।'), cacheKey('पासपोर्ट कैसे बनवाएं'));
});

test('language detection: English, Hindi, Hinglish', () => {
  assert.equal(detectLang('How do I renew my passport?'), 'en');
  assert.equal(detectLang('पासपोर्ट का नवीनीकरण कैसे करें?'), 'hi');
  assert.equal(detectLang('PAN card kaise banwayein?'), 'hinglish');
  assert.equal(detectLang('Mera driving licence renew karna hai'), 'hinglish');
  assert.equal(detectLang('Is a PAN card needed for ITR?'), 'en');
  assert.equal(detectLang('मेरा PAN card खो गया है'), 'hi');
});

test('related portals follow the question topic', () => {
  assert.equal(relatedPortals('lost my phone, how to block it')[0].name, 'Sanchar Saathi');
  assert.equal(relatedPortals('आधार में पता बदलना है')[0].name, 'myAadhaar');
  assert.equal(relatedPortals('something unrelated').length, 3);
});
