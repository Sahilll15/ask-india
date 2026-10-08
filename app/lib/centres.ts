export type Centre = {
  /** What the place is called on the answer card. */
  name: string;
  /** What we search for in Google Maps. */
  maps: string;
  /** An official centre finder, only where one was checked to load. */
  official?: { label: string; url: string };
};

const CENTRES: { re: RegExp; centre: Centre }[] = [
  {
    re: /\b(aadhaa?r|uidai)\b|आधार/i,
    centre: {
      name: 'Aadhaar centre',
      maps: 'Aadhaar Seva Kendra',
      official: {
        label: 'UIDAI centre map',
        url: 'https://bhuvan-app3.nrsc.gov.in/aadhaar/',
      },
    },
  },
  {
    re: /\bpassport\b|पासपोर्ट/i,
    centre: {
      name: 'Passport Seva Kendra',
      maps: 'Passport Seva Kendra',
      official: {
        label: 'Passport Seva',
        url: 'https://www.passportindia.gov.in/psp/',
      },
    },
  },
  {
    re: /\b(driving|licen[cs]e|learner'?s?|dl|rto|vehicle|rc)\b|लाइसेंस|ड्राइविंग|वाहन/i,
    centre: { name: 'RTO office', maps: 'RTO office' },
  },
  {
    re: /\bpan\b|पैन/i,
    centre: { name: 'PAN centre', maps: 'PAN card centre' },
  },
  {
    re: /\b(voter|epic)\b|मतदाता/i,
    centre: {
      name: 'voter registration office',
      maps: 'Electoral Registration Office',
    },
  },
  {
    re: /\b(ayushman|pm-?jay|e-?shram)\b|आयुष्मान/i,
    centre: {
      name: 'Common Service Centre',
      maps: 'Common Service Centre CSC',
    },
  },
];

function firstIn(text: string) {
  const hits = CENTRES.map((c) => ({
    c,
    at: text.match(c.re)?.index ?? -1,
  })).filter((h) => h.at >= 0);
  hits.sort((a, b) => a.at - b.at);
  return hits[0]?.c.centre ?? null;
}

/** The kind of office to visit in person, matched on the question first and the answer second. */
export function centreFor(question: string, answer = ''): Centre | null {
  return firstIn(question) ?? firstIn(answer);
}

/** Google Maps uses the person's own location for "near me", so nothing personal goes in the URL. */
export function mapsSearchUrl(centre: Centre) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${centre.maps} near me`)}`;
}
