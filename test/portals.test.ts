import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portalsFor, searchHint } from '../app/lib/directory.ts';
import { NOT_FOUND } from '../app/lib/lang.ts';

const names = (q: string) => portalsFor(q).map((p) => p.name);

test('fallback portals follow the topics of the question and never drift', () => {
  assert.deepEqual(names('How do I update my Aadhaar card as well as PAN card?'), ['myAadhaar', 'Income Tax e-filing', 'UIDAI']);
  assert.deepEqual(names('how to apply to gst'), ['GST portal']);
  assert.deepEqual(names('Driving licence renew kaise karein?'), ['Sarathi', 'Parivahan']);
  assert.ok(!names('How do I update my Aadhaar?').includes('Voters Service Portal'));
  assert.deepEqual(names('something unrelated'), ['National Portal of India']);
});

test('retry search hints name the topic and its national portal in plain words', () => {
  assert.equal(searchHint('how to apply to gst'), 'GST registration gst.gov.in');
  assert.match(searchHint('update Aadhaar and PAN'), /myaadhaar\.uidai\.gov\.in.*incometax\.gov\.in/);
  assert.ok(!/site:/.test(searchHint('passport renewal')));
});

test('fallback copy is softer in all three languages', () => {
  assert.match(NOT_FOUND.en, /^I couldn't confirm the exact steps on an official page just now\./);
  assert.ok(NOT_FOUND.hi.includes('आधिकारिक'));
  assert.match(NOT_FOUND.hinglish, /official portals/);
});
