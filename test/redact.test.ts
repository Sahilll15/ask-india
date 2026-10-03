import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, verhoeffValid, luhnValid, removedNotice } from '../app/lib/redact.ts';

// 23456789012 + Verhoeff check digit, computed rather than hard-coded so the test documents the rule.
function withVerhoeff(base: string) {
  for (let d = 0; d <= 9; d++) if (verhoeffValid(base + d)) return base + d;
  throw new Error('no check digit');
}
const AADHAAR = withVerhoeff('23456789012');
const spaced = `${AADHAAR.slice(0, 4)} ${AADHAAR.slice(4, 8)} ${AADHAAR.slice(8)}`;

test('verhoeff and luhn helpers', () => {
  assert.ok(verhoeffValid(AADHAAR));
  assert.ok(!verhoeffValid(AADHAAR.slice(0, 11) + ((Number(AADHAAR[11]) + 1) % 10)));
  assert.ok(luhnValid('4111111111111111'));
  assert.ok(!luhnValid('4111111111111112'));
});

test('Aadhaar, contiguous and spaced, is labelled as Aadhaar', () => {
  for (const form of [AADHAAR, spaced, spaced.replaceAll(' ', '-')]) {
    const r = redact(`my aadhaar is ${form} please help`);
    assert.equal(r.text, 'my aadhaar is [Aadhaar removed] please help');
    assert.deepEqual(r.removed, ['Aadhaar number']);
  }
});

test('a 12-digit run that fails Verhoeff is still removed', () => {
  const bad = AADHAAR.slice(0, 11) + ((Number(AADHAAR[11]) + 1) % 10);
  const r = redact(`number ${bad}`);
  assert.equal(r.text, 'number [number removed]');
  assert.deepEqual(r.removed, ['ID-like number']);
});

test('Hindi text around an Aadhaar number, including Devanagari digits', () => {
  const r = redact(`मेरा आधार नंबर ${spaced} है, पता कैसे बदलें?`);
  assert.equal(r.text, 'मेरा आधार नंबर [Aadhaar removed] है, पता कैसे बदलें?');
  const deva = AADHAAR.replace(/[0-9]/g, (d) => String.fromCharCode(0x0966 + Number(d)));
  const r2 = redact(`आधार ${deva} है`);
  assert.equal(r2.text, 'आधार [Aadhaar removed] है');
});

test('PAN, voter ID, passport and IFSC', () => {
  assert.deepEqual(redact('PAN ABCDE1234F').removed, ['PAN']);
  assert.equal(redact('pan abcde1234f').text, 'pan [PAN removed]');
  assert.deepEqual(redact('EPIC no XYZ1234567').removed, ['Voter ID']);
  assert.deepEqual(redact('passport J8369854 expired').removed, ['Passport number']);
  assert.deepEqual(redact('IFSC SBIN0001234').removed, ['IFSC code']);
});

test('mobile numbers in the common Indian formats', () => {
  for (const p of ['9876543210', '+91 9876543210', '+919876543210', '+91-98765 43210', '098765 43210', '98765 43210', '987 654 3210']) {
    const r = redact(`call me on ${p} today`);
    assert.equal(r.text, 'call me on [phone removed] today', p);
    assert.deepEqual(r.removed, ['Phone number'], p);
  }
});

test('email, card and bank account', () => {
  assert.equal(redact('mail a.b+c@example.co.in now').text, 'mail [email removed] now');
  assert.deepEqual(redact('card 4111 1111 1111 1111').removed, ['Card number']);
  assert.deepEqual(redact('card 4111111111111111').removed, ['Card number']);
  assert.deepEqual(redact('a/c 123456789012345').removed, ['Bank account number']);
  assert.deepEqual(redact('account 50100123456').removed, ['Bank account number']);
});

test('does not over-redact years, fees, pin codes, sections or dates', () => {
  const samples = [
    'ITR deadline for 2025 is in July',
    'The fee is Rs 1,500 or ₹75 for updates',
    'Fee ₹ 1500 for 36 pages, 2000 for 60 pages',
    'My PIN code is 400001',
    'Section 80C limit is 150000',
    'Form 16 for FY 2024-25 and AY 2025-26',
    'Born on 15/08/1990',
    'Years 2023 2024 2025',
    'Call helpline 1947 or 14546',
    'मैंने 2025 में ₹1,500 फीस भरी',
  ];
  for (const s of samples) {
    const r = redact(s);
    assert.equal(r.text, s, s);
    assert.deepEqual(r.removed, [], s);
  }
});

test('several identifiers at once and the notice text', () => {
  const r = redact(`Aadhaar ${AADHAAR}, phone 9876543210, email x@y.com`);
  assert.deepEqual(new Set(r.removed), new Set(['Aadhaar number', 'Phone number', 'Email']));
  assert.match(removedNotice(['Aadhaar number', 'Phone number']), /^We removed: Aadhaar number, phone$/);
});
