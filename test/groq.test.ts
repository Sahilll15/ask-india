import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groqKeys, groqPass, retryAfterMs, retryableUpstream, withGroqKeys } from '../app/server/groq.ts';
import { applyCitations } from '../app/lib/citations.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/groq-aadhaar.json', import.meta.url), 'utf8'));

test('browser markers become official citations pointing at the page that was opened', () => {
  const pass = groqPass(fixture);
  assert.ok(!/【/.test(pass.text), 'no raw markers left in the answer');
  const urls = new Set(pass.annotations.map((a) => a.url));
  assert.ok(
    urls.has('https://www.uidai.gov.in/en/contact-support/have-any-question/922-english-uk/faqs/aadhaar-online-services/online-address-update-process.html'),
  );
  assert.ok([...urls].every((u) => u && /uidai\.gov\.in/.test(u)));
});

test('the converted pass works with the existing citation pipeline', () => {
  const pass = groqPass(fixture);
  const cited = applyCitations(pass.text, pass.annotations);
  assert.ok(cited.sources.length >= 2);
  assert.match(cited.text, /\[1\]/);
  assert.ok(cited.sources.every((s) => s.domain.endsWith('gov.in')));
});

test('searches are counted and only official search results are kept', () => {
  const pass = groqPass(fixture);
  assert.equal(pass.searches, 2);
  assert.ok(pass.searchUrls.length > 0);
  assert.ok(
    pass.searchUrls.every((u) => /\.(gov|nic)\.in\//.test(u)),
    pass.searchUrls.join(' '),
  );
});

test('a reply with no tools or markers passes through untouched', () => {
  const pass = groqPass({
    content: '[[DECLINE]] I only explain official procedures.',
    executed_tools: [],
  });
  assert.equal(pass.text, '[[DECLINE]] I only explain official procedures.');
  assert.equal(pass.annotations.length, 0);
  assert.equal(pass.searches, 0);
});

test('only rate limits, server errors and network failures fall back to OpenAI', () => {
  assert.equal(retryableUpstream({ status: 429 }), true);
  assert.equal(retryableUpstream({ status: 503 }), true);
  assert.equal(retryableUpstream({ status: 413 }), true);
  assert.equal(retryableUpstream(new TypeError('fetch failed')), true);
  assert.equal(retryableUpstream({ status: 400 }), false);
  assert.equal(retryableUpstream({ status: 401 }), false);
});

const fakeErr = (status: number, message = '', headers: Record<string, string> = {}) => Object.assign(new Error(message), { status, headers });

test('keys come from GROQ_API_KEY then GROQ_API_KEYS, deduped and in order', () => {
  assert.deepEqual(groqKeys({ GROQ_API_KEY: 'a', GROQ_API_KEYS: ' b, a ,\nc,, ' }), ['a', 'b', 'c']);
  assert.deepEqual(groqKeys({ GROQ_API_KEYS: 'x,y' }), ['x', 'y']);
  assert.deepEqual(groqKeys({}), []);
});

test('a rate limited key is parked and the next key answers', async () => {
  const cool = new Map<string, number>();
  const used: string[] = [];
  const answer = await withGroqKeys(
    async (c: { key: string }) => {
      used.push(c.key);
      if (c.key === 'a') throw fakeErr(429, 'Please try again in 2m30s.');
      return `ok from ${c.key}`;
    },
    { keys: ['a', 'b'], cool, now: () => 0, make: (key) => ({ key }) },
  );
  assert.equal(answer, 'ok from b');
  assert.deepEqual(used, ['a', 'b']);
  assert.equal(cool.get('a'), 150_000);
});

test('a parked key is skipped until its cooldown ends', async () => {
  const cool = new Map([['a', 1_000]]);
  const used: string[] = [];
  const call = async (c: { key: string }) => (used.push(c.key), c.key);
  await withGroqKeys(call, { keys: ['a', 'b'], cool, now: () => 500, make: (key) => ({ key }) });
  await withGroqKeys(call, { keys: ['a', 'b'], cool, now: () => 2_000, make: (key) => ({ key }) });
  assert.deepEqual(used, ['b', 'a']);
});

test('a rejected key is parked for an hour and the next key is tried', async () => {
  const cool = new Map<string, number>();
  const out = await withGroqKeys(
    async (c: { key: string }) => {
      if (c.key === 'bad') throw fakeErr(401, 'Invalid API Key');
      return c.key;
    },
    { keys: ['bad', 'good'], cool, now: () => 0, make: (key) => ({ key }) },
  );
  assert.equal(out, 'good');
  assert.equal(cool.get('bad'), 3_600_000);
});

test('when every key is limited the last error is retryable, so OpenAI can take over', async () => {
  const err = await withGroqKeys(
    async () => {
      throw fakeErr(429);
    },
    { keys: ['a', 'b'], cool: new Map(), now: () => 0, make: (key) => ({ key }) },
  ).catch((e) => e);
  assert.equal(retryableUpstream(err), true);
  const allParked = await withGroqKeys(async () => 'never', { keys: ['a'], cool: new Map([['a', 10]]), now: () => 0, make: (key) => ({ key }) }).catch(
    (e) => e,
  );
  assert.equal(retryableUpstream(allParked), true);
});

test('a Groq outage is not retried on other keys', async () => {
  const used: string[] = [];
  const err = await withGroqKeys(
    async (c: { key: string }) => {
      used.push(c.key);
      throw fakeErr(503);
    },
    { keys: ['a', 'b'], cool: new Map(), now: () => 0, make: (key) => ({ key }) },
  ).catch((e) => e);
  assert.equal(err.status, 503);
  assert.deepEqual(used, ['a']);
});

test('retry-after comes from the header, then the message, then a one minute default', () => {
  assert.equal(retryAfterMs(fakeErr(429, '', { 'retry-after': '12' })), 12_000);
  assert.equal(retryAfterMs(fakeErr(429, 'Please try again in 6m6.768s.')), 366_768);
  assert.equal(retryAfterMs(fakeErr(429, 'Please try again in 900ms.')), 1_000);
  assert.equal(retryAfterMs(fakeErr(429, '', { 'retry-after': '99999999' })), 86_400_000);
  assert.equal(retryAfterMs(fakeErr(429)), 60_000);
});
