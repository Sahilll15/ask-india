export type RemovedKind =
  | 'Aadhaar number'
  | 'ID-like number'
  | 'PAN'
  | 'Voter ID'
  | 'Passport number'
  | 'Phone number'
  | 'Email'
  | 'IFSC code'
  | 'Bank account number'
  | 'Card number';

export type Redacted = { text: string; removed: RemovedKind[] };

const D = '[0-9\\u0966-\\u096F]';
const NOT_DIGIT_BEFORE = '(?<![0-9\\u0966-\\u096F])';
const NOT_DIGIT_AFTER = '(?![0-9\\u0966-\\u096F])';
const NOT_ALNUM_BEFORE = '(?<![A-Za-z0-9])';
const NOT_ALNUM_AFTER = '(?![A-Za-z0-9])';

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 7, 6, 8, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Maps Devanagari digits to ASCII and drops separators. */
export function digitsOf(s: string) {
  return s.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966)).replace(/[^0-9]/g, '');
}

export function verhoeffValid(num: string) {
  const digits = digitsOf(num);
  if (!digits) return false;
  let c = 0;
  const rev = digits.split('').reverse();
  for (let i = 0; i < rev.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(rev[i])]];
  return c === 0;
}

export function luhnValid(num: string) {
  const digits = digitsOf(num);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length > 0 && sum % 10 === 0;
}

const isAadhaarShape = (digits: string) => /^[2-9]\d{11}$/.test(digits) && verhoeffValid(digits);
const looksLikeYears = (raw: string) => raw.split(/[ -]/).every((g) => /^(19|20)\d\d$/.test(digitsOf(g)));

type Rule = { re: RegExp; kind: (match: string) => RemovedKind | null };

const RULES: Rule[] = [
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, kind: () => 'Email' },
  {
    re: new RegExp(
      `(?:\\+\\s?91|${NOT_DIGIT_BEFORE}0091|${NOT_DIGIT_BEFORE}91)[ -]?[6-9](?:${D}{9}|${D}{4}[ -]${D}{5})${NOT_DIGIT_AFTER}`,
      'g',
    ),
    kind: () => 'Phone number',
  },
  {
    re: new RegExp(`${NOT_DIGIT_BEFORE}${D}{4}([ -]?)${D}{4}\\1${D}{4}\\1${D}{4}(?:\\1?${D}{1,3})?${NOT_DIGIT_AFTER}`, 'g'),
    kind: (m) => (luhnValid(m) ? 'Card number' : 'Bank account number'),
  },
  {
    re: new RegExp(`${NOT_DIGIT_BEFORE}${D}{4}([ -]?)${D}{4}\\1${D}{4}${NOT_DIGIT_AFTER}`, 'g'),
    kind: (m) => {
      if (/[ -]/.test(m) && looksLikeYears(m)) return null;
      return isAadhaarShape(digitsOf(m)) ? 'Aadhaar number' : 'ID-like number';
    },
  },
  {
    re: new RegExp(
      `${NOT_DIGIT_BEFORE}0?(?:[6-9\\u096C-\\u096F]${D}{9}|[6-9]${D}{4}[ -]${D}{5}|[6-9]${D}{2}[ -]${D}{3}[ -]${D}{4})${NOT_DIGIT_AFTER}`,
      'g',
    ),
    kind: () => 'Phone number',
  },
  {
    re: new RegExp(`${NOT_DIGIT_BEFORE}${D}{9,18}${NOT_DIGIT_AFTER}`, 'g'),
    kind: (m) => (digitsOf(m).length >= 13 && luhnValid(m) ? 'Card number' : 'Bank account number'),
  },
  { re: new RegExp(`${NOT_ALNUM_BEFORE}[A-Za-z]{4}0[A-Za-z0-9]{6}${NOT_ALNUM_AFTER}`, 'g'), kind: () => 'IFSC code' },
  { re: new RegExp(`${NOT_ALNUM_BEFORE}[A-Za-z]{5}[0-9]{4}[A-Za-z]${NOT_ALNUM_AFTER}`, 'g'), kind: () => 'PAN' },
  { re: new RegExp(`${NOT_ALNUM_BEFORE}[A-Za-z]{3}[0-9]{7}${NOT_ALNUM_AFTER}`, 'g'), kind: () => 'Voter ID' },
  { re: new RegExp(`${NOT_ALNUM_BEFORE}[A-Za-z][0-9]{7}${NOT_ALNUM_AFTER}`, 'g'), kind: () => 'Passport number' },
];

const PLACEHOLDER: Record<RemovedKind, string> = {
  'Aadhaar number': '[Aadhaar removed]',
  'ID-like number': '[number removed]',
  PAN: '[PAN removed]',
  'Voter ID': '[voter ID removed]',
  'Passport number': '[passport no. removed]',
  'Phone number': '[phone removed]',
  Email: '[email removed]',
  'IFSC code': '[IFSC removed]',
  'Bank account number': '[account no. removed]',
  'Card number': '[card no. removed]',
};

/** Strips Indian personal identifiers. Runs in the browser before sending and again on the server. */
export function redact(input: string): Redacted {
  const removed = new Set<RemovedKind>();
  let text = input;
  for (const rule of RULES) {
    text = text.replace(rule.re, (m) => {
      const kind = rule.kind(m);
      if (!kind) return m;
      removed.add(kind);
      return PLACEHOLDER[kind];
    });
  }
  return { text, removed: [...removed] };
}

export function removedNotice(kinds: RemovedKind[]) {
  if (!kinds.length) return '';
  const names = kinds.map((k) => (k === 'Phone number' ? 'phone' : k === 'Email' ? 'email' : k));
  return `We removed: ${names.join(', ')}`;
}
