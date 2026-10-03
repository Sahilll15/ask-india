import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, guideForQuestion } from '../app/guides/data.ts';
import { CATEGORIES } from '../app/lib/directory.ts';

const OFFICIAL = /(^|\.)(gov\.in|nic\.in)$/;

test('every guide cites only https official sources', () => {
  for (const g of GUIDES) {
    assert.ok(g.sources.length > 0, g.slug);
    for (const s of g.sources) {
      const u = new URL(s.url);
      assert.equal(u.protocol, 'https:', s.url);
      assert.match(u.hostname, OFFICIAL, s.url);
    }
  }
});

test('guide slugs are unique and url safe', () => {
  const slugs = GUIDES.map((g) => g.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/);
});

test('guide copy avoids dashes used as punctuation and curly quotes', () => {
  for (const g of GUIDES) {
    const text = JSON.stringify(g);
    assert.ok(!/[–—‘’“”]/.test(text), g.slug);
  }
});

test('directory questions mapped to a guide exist in the directory', () => {
  const all = new Set(CATEGORIES.flatMap((c) => c.questions));
  for (const g of GUIDES) for (const q of g.directoryQuestions) assert.ok(all.has(q), q);
  assert.equal(guideForQuestion('How do I link my PAN with Aadhaar?')?.slug, 'link-pan-with-aadhaar');
});
