import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCitations, stripStrayLinks, streamingView } from '../app/lib/citations.ts';
import { cleanUrl, isOfficialHost, isOfficialUrl } from '../app/lib/domains.ts';

test('official hosts: gov.in, nic.in and real subdomains', () => {
  for (const u of [
    'https://uidai.gov.in/en/updating-data-on-aadhaar',
    'https://www.incometax.gov.in/iec/foportal/',
    'https://indiacode.nic.in/',
    'https://myaadhaar.uidai.gov.in/',
    'http://gov.in/',
    'https://UIDAI.GOV.IN./x',
  ]) assert.ok(isOfficialUrl(u), u);
});

test('lookalikes and tricks are rejected', () => {
  for (const u of [
    'https://gov.in.evil.com/',
    'https://evilgov.in/',
    'https://uidai-gov.in/',
    'https://uidai.gov.in.example.org/path',
    'https://gov.in@evil.com/',
    'https://evil.com/?u=https://uidai.gov.in',
    'https://nic.in.co/',
    'https://xgov.in/',
    'javascript:alert(1)//gov.in',
    'ftp://uidai.gov.in/',
    'not a url',
  ]) assert.ok(!isOfficialUrl(u), u);
  assert.ok(!isOfficialHost('gov.in..evil'));
});

test('cleanUrl drops utm params only', () => {
  assert.equal(cleanUrl('https://uidai.gov.in/a?utm_source=openai&x=1'), 'https://uidai.gov.in/a?x=1');
});

const T1 = 'Use myAadhaar. ([uidai.gov.in](https://uidai.gov.in/a?utm_source=openai))';
const T2 = ' Pay the fee. ([evil.com](https://evil.com/x))';
const T3 = ' Then submit. ([uidai.gov.in](https://uidai.gov.in/a?utm_source=openai))';

test('applyCitations numbers official sources and replaces inline links with markers', () => {
  const text = T1 + T2 + T3;
  const ann = [
    { type: 'url_citation', url: 'https://uidai.gov.in/a?utm_source=openai', title: 'Updating Data - UIDAI', start_index: 15, end_index: T1.length },
    { type: 'url_citation', url: 'https://evil.com/x', title: 'Evil', start_index: T1.length + 14, end_index: T1.length + T2.length },
    { type: 'url_citation', url: 'https://uidai.gov.in/a?utm_source=openai', title: 'Updating Data - UIDAI', start_index: T1.length + T2.length + 14, end_index: text.length },
  ];
  const r = applyCitations(text, ann);
  assert.equal(r.text, 'Use myAadhaar. [1] Pay the fee. Then submit. [1]');
  assert.deepEqual(r.sources, [{ n: 1, url: 'https://uidai.gov.in/a', title: 'Updating Data', domain: 'uidai.gov.in' }]);
});

test('applyCitations with only lookalike citations yields no sources', () => {
  const text = 'Fees are 500. ([x](https://gov.in.evil.com/a))';
  const r = applyCitations(text, [{ type: 'url_citation', url: 'https://gov.in.evil.com/a', start_index: 14, end_index: text.length }]);
  assert.equal(r.sources.length, 0);
  assert.ok(!r.text.includes('evil'));
});

test('unannotated official links still become numbered sources', () => {
  const r = applyCitations('Apply online. ([passportindia.gov.in](https://www.passportindia.gov.in/psp))', []);
  assert.equal(r.text, 'Apply online. [1]');
  assert.equal(r.sources[0].domain, 'passportindia.gov.in');
});

test('stripStrayLinks and streamingView hide non-official and half-written links', () => {
  assert.equal(stripStrayLinks('see [site](https://evilgov.in/x) and https://evil.com/a'), 'see site and ');
  assert.equal(streamingView('Step one. ([uidai.gov.in](https://uidai.gov.in/a)) Step two ([uid'), 'Step one. Step two');
});

test('dropOffer removes an uncited closing offer in any of the three languages', async () => {
  const { dropOffer } = await import('../app/lib/citations.ts');
  assert.equal(dropOffer('Answer. [1]\n\nIf you want, I can list the documents.'), 'Answer. [1]');
  assert.equal(dropOffer('जवाब। [1]\n\nअगर चाहें, मैं दस्तावेज़ों की सूची बता सकता हूँ।'), 'जवाब। [1]');
  assert.equal(dropOffer('Answer. [1]\n\nIf you want a refund, apply within 30 days. [2]'), 'Answer. [1]\n\nIf you want a refund, apply within 30 days. [2]');
});
