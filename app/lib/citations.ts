import { cleanUrl, displayDomain, isOfficialUrl } from './domains.ts';

export type Annotation = { type: string; url?: string; title?: string; start_index?: number; end_index?: number };
export type Source = { n: number; url: string; title: string; domain: string };

export const DECLINE_TAG = '[[DECLINE]]';

/** Keeps only official citations, numbers them by first use and swaps each inline link for a [n] marker. */
export function applyCitations(text: string, annotations: Annotation[]) {
  const official = annotations
    .filter((a) => a.type === 'url_citation' && a.url && isOfficialUrl(a.url))
    .map((a) => ({ ...a, url: cleanUrl(a.url!) }))
    .sort((a, b) => (a.start_index ?? 0) - (b.start_index ?? 0));

  const sources: Source[] = [];
  const numberOf = new Map<string, number>();
  for (const a of official) {
    if (numberOf.has(a.url)) continue;
    numberOf.set(a.url, sources.length + 1);
    sources.push({ n: sources.length + 1, url: a.url, title: tidyTitle(a.title ?? '', a.url), domain: displayDomain(a.url) });
  }

  let out = text;
  const byEnd = [...official].sort((a, b) => (b.end_index ?? 0) - (a.end_index ?? 0));
  for (const a of byEnd) {
    const start = a.start_index ?? -1;
    const end = a.end_index ?? -1;
    const marker = ` [${numberOf.get(a.url)}]`;
    if (start >= 0 && end > start && end <= out.length && /^\s*\(?\[/.test(out.slice(start, end))) {
      out = out.slice(0, start).replace(/\s+$/, '') + marker + out.slice(end);
    } else if (end >= 0 && end <= out.length) {
      out = out.slice(0, end) + marker + out.slice(end);
    }
  }

  out = out.replace(/\s*\(\s*\[([^\]]*)\]\(([^)\s]+)\)\s*\)/g, (m, label: string, raw: string) => {
    if (!isOfficialUrl(raw)) return m;
    const url = cleanUrl(raw);
    if (!numberOf.has(url)) {
      numberOf.set(url, sources.length + 1);
      sources.push({ n: sources.length + 1, url, title: tidyTitle(label, url), domain: displayDomain(url) });
    }
    return ` [${numberOf.get(url)}]`;
  });
  out = stripStrayLinks(out);
  out = out.replace(/(\[\d+\])(\s*\1)+/g, '$1').replace(/(\S) {2,}/g, '$1 ').replace(/[ \t]+\n/g, '\n').trim();
  return { text: out, sources };
}

/** Turns any remaining markdown link to a non-official site into plain text, and drops bare non-official URLs. */
export function stripStrayLinks(text: string) {
  return text
    .replace(/\(\s*\[([^\]]*)\]\(([^)\s]+)\)\s*\)/g, (m, label: string, url: string) => (isOfficialUrl(url) ? m : ''))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, url: string) => (isOfficialUrl(url) ? m : label))
    .replace(/https?:\/\/[^\s)\]]+/g, (url) => (isOfficialUrl(url) ? url : ''));
}

function tidyTitle(title: string, url: string) {
  if (/[\r\n]/.test(title.trim())) return displayDomain(url);
  const parts = title.replace(/[[\]]/g, '').replace(/_/g, ' ').split(/\s+[-|:]{1,2}\s+/).map((s) => s.trim()).filter(Boolean);
  const t = parts[0] ?? '';
  return (t.length > 90 ? `${t.slice(0, 87)}...` : t) || displayDomain(url);
}

/** For live display while text streams: hides inline citation links, including a half-written one at the end. */
export function streamingView(text: string) {
  return text
    .replace(DECLINE_TAG, '')
    .replace(/\s*\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s*\(\[[^)]*$/, '')
    .replace(/\s*\(\s*$/, '');
}

const OFFER = /^(if you (want|would like|need|like)|let me know|would you like|agar (aap )?chah|agar aapko|अगर (आप )?चाह|अगर आपको|क्या आप चाहेंगे)/i;

/** Drops a trailing "if you want, I can also..." paragraph that carries no citation. */
export function dropOffer(text: string) {
  const paras = text.trim().split(/\n\s*\n/);
  const last = paras.at(-1)?.trim() ?? '';
  return paras.length > 1 && OFFER.test(last) && !/\[\d{1,2}\]/.test(last) ? paras.slice(0, -1).join('\n\n') : text;
}

/** Every official URL the answer would show: source cards plus any inline markdown links left in the text. */
export function shownUrls(text: string, sources: Source[]) {
  const inline = [...text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter(isOfficialUrl);
  return [...new Set([...sources.map((s) => s.url), ...inline])];
}

/**
 * Keeps only sources whose link passed the check, renumbers them 1..n in order and rewrites the [n] markers.
 * Markers of dropped sources and inline links that failed are removed.
 */
export function keepVerified(text: string, sources: Source[], verified: (url: string) => boolean) {
  const kept = sources.filter((s) => verified(s.url));
  const renumber = new Map(kept.map((s, i) => [s.n, i + 1]));
  const out = text
    .replace(/[ \t]?\[(\d{1,2})\](?!\()/g, (_m, n: string) => {
      const next = renumber.get(Number(n));
      return next ? ` [${next}]` : '';
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, url: string) => (isOfficialUrl(url) && verified(url) ? m : label))
    .replace(/(\[\d+\])(\s*\1)+/g, '$1')
    .replace(/(\S) {2,}/g, '$1 ')
    .replace(/ +([.,;:!?।])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return { text: out, sources: kept.map((s, i) => ({ ...s, n: i + 1 })) };
}
