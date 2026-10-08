import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centreFor, mapsSearchUrl } from '../app/lib/centres.ts';

test('in-person centres follow the topic of the question', () => {
  assert.equal(
    centreFor('How do I update my address in Aadhaar?')?.name,
    'Aadhaar centre',
  );
  assert.equal(centreFor('आधार में पता कैसे बदलें?')?.name, 'Aadhaar centre');
  assert.equal(
    centreFor('पासपोर्ट का नवीनीकरण कैसे करें?')?.name,
    'Passport Seva Kendra',
  );
  assert.equal(
    centreFor('Driving licence renew kaise karein?')?.name,
    'RTO office',
  );
  assert.equal(
    centreFor('How do I apply for a new PAN card?')?.name,
    'PAN centre',
  );
});

test('the question wins over the answer, and unrelated questions get no centre', () => {
  assert.equal(
    centreFor('passport renewal', 'Carry your Aadhaar card.')?.name,
    'Passport Seva Kendra',
  );
  assert.equal(
    centreFor('What documents do I need?', 'Visit the RTO with your licence.')
      ?.name,
    'RTO office',
  );
  assert.equal(centreFor('How do I report an online fraud?'), null);
});

test('official finders are only listed on government hosts', () => {
  const aadhaar = centreFor('Aadhaar update');
  assert.ok(aadhaar?.official);
  assert.match(new URL(aadhaar.official.url).hostname, /\.gov\.in$/);
});

test('the maps link searches near the person without sending any personal data', () => {
  const url = new URL(mapsSearchUrl(centreFor('Aadhaar update')!));
  assert.equal(url.hostname, 'www.google.com');
  assert.equal(url.searchParams.get('query'), 'Aadhaar Seva Kendra near me');
});
