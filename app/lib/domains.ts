/** Roots the search tool is limited to. The filter matches subdomains too. */
export const SEARCH_DOMAINS = ['gov.in', 'nic.in'];

/** Portals checked by hand. All sit under gov.in or nic.in; listed so the intent is explicit. */
export const KNOWN_OFFICIAL_HOSTS = [
  'india.gov.in',
  'uidai.gov.in',
  'incometax.gov.in',
  'passportindia.gov.in',
  'gst.gov.in',
  'parivahan.gov.in',
  'epfindia.gov.in',
  'epfo.gov.in',
  'mca.gov.in',
  'eci.gov.in',
  'digilocker.gov.in',
  'sancharsaathi.gov.in',
  'pgportal.gov.in',
  'indiacode.nic.in',
  'udyamregistration.gov.in',
  'pmkisan.gov.in',
  'nha.gov.in',
  'scholarships.gov.in',
  'ociservices.gov.in',
  'madad.gov.in',
  'cybercrime.gov.in',
  'consumerhelpline.gov.in',
  'ecourts.gov.in',
  'abdm.gov.in',
];

const ALLOWED_ROOTS = [...SEARCH_DOMAINS, ...KNOWN_OFFICIAL_HOSTS];

export function hostOf(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

const PREVIEW_LABEL = /^(staging|stage|stg|test|testing|uat|dev|develop|demo|beta|preprod|sandbox|qa)(\d+|-.*)?$/;

/** Staging, test, UAT, dev, demo and beta copies of a portal are never shown to users. */
export function isPreviewHost(host: string) {
  return host.toLowerCase().split('.').some((label) => PREVIEW_LABEL.test(label));
}

/** True only for gov.in, nic.in or an allow-listed host, or a real subdomain of one that is not a preview copy. */
export function isOfficialHost(host: string) {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h || /[^a-z0-9.-]/.test(h) || h.includes('..') || isPreviewHost(h)) return false;
  return ALLOWED_ROOTS.some((root) => h === root || h.endsWith(`.${root}`));
}

export function isOfficialUrl(raw: string) {
  const host = hostOf(raw);
  return host !== null && isOfficialHost(host);
}

/** Drops tracking params the search tool appends. */
export function cleanUrl(raw: string) {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) if (key.startsWith('utm_')) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return raw;
  }
}

export function displayDomain(raw: string) {
  return (hostOf(raw) ?? raw).replace(/^www\./, '');
}
