import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groqPass, retryableUpstream } from '../app/server/groq.ts';
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
