import { z } from 'zod';
import type { ResponseInputItem, ResponseStreamEvent } from 'openai/resources/responses/responses';
import { applyCitations, DECLINE_TAG, dropOffer, keepVerified, shownUrls, stripStrayLinks, type Annotation, type Source } from '../../lib/citations.ts';
import { bestPortal, portalsFor, relatedPortals, searchHint, type Portal } from '../../lib/directory.ts';
import { cleanUrl, displayDomain, isOfficialUrl, SEARCH_DOMAINS } from '../../lib/domains.ts';
import { detectLang, FOOTER, NOT_FOUND, type Lang } from '../../lib/lang.ts';
import { redact, type RemovedKind } from '../../lib/redact.ts';
import { answerCache, cacheKey, counters } from '../../server/cache.ts';
import { bad, readJson, upstreamError } from '../../server/http.ts';
import { linkChecker } from '../../server/linkcheck.ts';
import { estimateCost, openai, TEXT_MODEL } from '../../server/openai.ts';
import { instructions } from '../../server/prompts.ts';
import { DAILY_QUESTIONS, LIMITS, LimiterUnavailable, budgetSpent, check, limiterBusy, peek, questionBudget, tooMany } from '../../server/ratelimit.ts';

export const maxDuration = 60;

const MAX_BODY = 16_000;
const MAX_QUESTION = 500;
const MAX_ANSWER_CONTEXT = 2000;
const MAX_SEARCHES = Math.min(4, Math.max(1, Number(process.env.MAX_SEARCHES) || 2));

const Body = z.object({
  question: z.string().max(MAX_QUESTION),
  history: z
    .array(z.object({ q: z.string().max(MAX_QUESTION), a: z.string().max(MAX_ANSWER_CONTEXT) }))
    .max(3)
    .optional()
    .default([]),
});

type Kind = 'answer' | 'decline' | 'nosource';
type Done = {
  t: 'done';
  kind: Kind;
  text: string;
  sources: Source[];
  related: Portal[];
  portal: Portal | null;
  footer: string;
  cached: boolean;
  quota: Quota | null;
  sourcesFrom?: 'citations' | 'search' | null;
  meta?: {
    ms: number;
    costUsd: number;
    searches: number;
    model: string;
    checkedLinks: number;
    droppedLinks: number;
    retried: boolean;
    sourcesFrom: 'citations' | 'search' | null;
  };
};
type Quota = { limit: number; remaining: number; resetAt: number | null };

const encoder = new TextEncoder();
const line = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);
const STREAM_HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
  'x-accel-buffering': 'no',
};

// A failed read only hides the counter; the client keeps its last known quota.
async function quotaOrNull(req: Request): Promise<Quota | null> {
  try {
    return { limit: LIMITS.question.limit, ...(await peek(req, 'question')) };
  } catch {
    return null;
  }
}

// Quota is served here next to POST; both read the same Redis counters.
export async function GET(req: Request) {
  try {
    const [{ remaining, resetAt }, used] = await Promise.all([peek(req, 'question'), questionBudget.used()]);
    const dailyLeft = Math.max(0, DAILY_QUESTIONS - used);
    return Response.json(
      { limit: LIMITS.question.limit, remaining: dailyLeft === 0 ? 0 : remaining, resetAt, dailyExhausted: dailyLeft === 0 },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof LimiterUnavailable) return limiterBusy();
    throw err;
  }
}

export async function POST(req: Request) {
  const read = await readJson(req, MAX_BODY);
  if (!read.ok) return read.res;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return bad('Send { question, history? } with a question of at most 500 characters.');

  const removed = new Set<RemovedKind>();
  const clean = (s: string) => {
    const r = redact(s.trim());
    r.removed.forEach((k) => removed.add(k));
    return r.text;
  };
  const question = clean(parsed.data.question);
  if (question.replace(/\[[^\]]*removed\]/g, '').trim().length < 3) return bad('Type a question first.');
  const history = parsed.data.history.map((h) => ({ q: clean(h.q), a: clean(h.a) }));
  const lang = detectLang(question);
  const key = history.length ? null : cacheKey(question);

  const hit = key ? answerCache.get(key) : null;
  if (hit) {
    counters.cached++;
    const done: Done = { t: 'done', kind: 'answer', ...hit, related: [], portal: bestPortal(question, hit.text), cached: true, quota: await quotaOrNull(req) };
    return new Response(new Blob([line({ t: 'meta', removed: [...removed], lang }), line(done)]).stream(), { headers: STREAM_HEADERS });
  }

  try {
    const gate = await check(req, 'question');
    if (!gate.ok) return tooMany(gate.retryAfter, `${LIMITS.question.limit} questions`);
    if (!(await questionBudget.take())) return budgetSpent();
  } catch (err) {
    if (err instanceof LimiterUnavailable) return limiterBusy();
    throw err;
  }
  counters.questions++;

  const input: ResponseInputItem[] = [
    ...history.flatMap((h): ResponseInputItem[] => [
      { role: 'user', content: h.q },
      { role: 'assistant', content: h.a },
    ]),
    { role: 'user', content: question },
  ];

  const started = Date.now();
  // The retry keeps the user's question but adds the official portal and plain search terms for its topic.
  const retryInput: ResponseInputItem[] = [
    ...input.slice(0, -1),
    { role: 'user', content: `${question}\n\nSearch for: ${searchHint(question)}` },
  ];
  const request = (forced: boolean) =>
    openai().responses.create({
      model: TEXT_MODEL,
      instructions: instructions(lang, new Date().toISOString().slice(0, 10)),
      input: forced ? retryInput : input,
      tools: [
        {
          type: 'web_search',
          filters: { allowed_domains: SEARCH_DOMAINS },
          search_context_size: 'low',
          user_location: { type: 'approximate', country: 'IN' },
        },
      ],
      ...(forced ? { tool_choice: 'required' as const } : {}),
      // Supported by the API but missing from this SDK version's create params type.
      ...({ max_tool_calls: MAX_SEARCHES } as object),
      include: ['web_search_call.action.sources'],
      reasoning: { effort: 'low' },
      max_output_tokens: 2500,
      store: false,
      stream: true,
    });

  let upstream: Awaited<ReturnType<typeof request>>;
  try {
    upstream = await request(false);
  } catch (err) {
    return upstreamError(err);
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(line(obj));
      send({ t: 'meta', removed: [...removed], lang });
      send({ t: 'status', stage: 'searching' });

      const links = linkChecker();
      let searches = 0;
      let costUsd = 0;
      let retried = false;
      let checkedLinks = 0;
      let droppedLinks = 0;
      let sourcesFrom: 'citations' | 'search' | null = null;

      const verify = async (urls: string[]) => {
        const verdicts = await links.verifyAll(urls);
        const bad = [...verdicts].filter(([, v]) => !v.ok);
        checkedLinks += verdicts.size;
        droppedLinks += bad.length;
        if (bad.length) console.warn('ask dropped links', JSON.stringify(bad.map(([url, v]) => ({ url, reason: v.reason }))));
        return (url: string) => verdicts.get(url)?.ok === true;
      };

      const resolve = async (pass: Pass): Promise<Done | null> => {
        const done = finish(null, lang, question, pass.text, pass.annotations);
        if (done.kind === 'decline') return done;
        if (done.kind === 'answer') {
          const ok = await verify(shownUrls(done.text, done.sources));
          const kept = keepVerified(done.text, done.sources, ok);
          if (kept.sources.length) {
            sourcesFrom = 'citations';
            return { ...done, text: kept.text, sources: kept.sources };
          }
        }
        // No usable citation: fall back to official pages the search itself returned, once they pass the check.
        const body = answerBody(pass.text);
        if (!body || !pass.searchUrls.length) return null;
        const ok = await verify(pass.searchUrls.slice(0, 6));
        const sources = pass.searchUrls.filter(ok).slice(0, 4).map((url, i) => searchSource(url, i + 1));
        if (!sources.length) return null;
        sourcesFrom = 'search';
        return { ...done, kind: 'answer', text: body, sources, related: [], portal: bestPortal(question, body) };
      };

      try {
        let pass = await runPass(upstream, send, links);
        searches += pass.searches;
        costUsd += estimateCost(pass.usage, pass.searches);
        logPass(1, pass);
        let done = await resolve(pass);

        if (!done) {
          retried = true;
          send({ t: 'reset' });
          send({ t: 'status', stage: 'searching' });
          upstream = await request(true);
          pass = await runPass(upstream, send, links);
          searches += pass.searches;
          costUsd += estimateCost(pass.usage, pass.searches);
          logPass(2, pass);
          done = await resolve(pass);
        }

        done ??= noSource(null, lang, question);
        done.quota = await quotaOrNull(req);
        costUsd = Math.round(costUsd * 10000) / 10000;
        done.meta = { ms: Date.now() - started, costUsd, searches, model: TEXT_MODEL, checkedLinks, droppedLinks, retried, sourcesFrom };
        done.sourcesFrom = sourcesFrom;
        if (done.kind === 'answer' && key) {
          answerCache.set(key, { text: done.text, sources: done.sources, lang, footer: done.footer, sourcesFrom });
        }
        console.log('ask', JSON.stringify({ kind: done.kind, lang, ms: done.meta.ms, costUsd, searches, sources: done.sources.length, sourcesFrom, retried, checkedLinks, droppedLinks }));
        send(done);
      } catch (err) {
        console.error('ask stream failed', (err as Error)?.message);
        send({ t: 'error', error: 'Something went wrong while answering. Try again.' });
      } finally {
        controller.close();
      }
    },
    cancel() {
      upstream.controller.abort();
    },
  });

  return new Response(body, { headers: STREAM_HEADERS });
}

type Pass = { text: string; annotations: Annotation[]; usage: Parameters<typeof estimateCost>[0]; searches: number; searchUrls: string[]; rawSources: number };

/** Streams one model run to the browser. Text is held back until the first official citation arrives. */
async function runPass(upstream: AsyncIterable<ResponseStreamEvent>, send: (obj: unknown) => void, links: ReturnType<typeof linkChecker>): Promise<Pass> {
  let pending = '';
  let open = false;
  let searches = 0;
  let rawSources = 0;
  const seen = new Set<string>();
  const searchUrls = new Set<string>();
  let text = '';
  let annotations: Annotation[] = [];
  let usage: Pass["usage"];

  for await (const ev of upstream) {
    if (ev.type === 'response.output_item.done' && ev.item.type === 'web_search_call') {
      searches++;
      const action = ev.item.action as { sources?: { url?: string }[] } | undefined;
      for (const s of action?.sources ?? []) {
        rawSources++;
        if (!s.url || !isOfficialUrl(s.url)) continue;
        seen.add(displayDomain(s.url));
        searchUrls.add(cleanUrl(s.url));
      }
      if (seen.size) send({ t: 'status', stage: 'reading', domains: [...seen].slice(0, 4) });
    } else if (ev.type === 'response.output_text.delta') {
      if (open) send({ t: 'delta', text: ev.delta });
      else pending += ev.delta;
    } else if (ev.type === 'response.output_text.annotation.added') {
      const a = ev.annotation as Annotation;
      if (a.type === 'url_citation' && a.url && isOfficialUrl(a.url)) {
        // Start checking each cited link while the text is still streaming.
        void links.verify(cleanUrl(a.url));
        if (!open) {
          open = true;
          send({ t: 'status', stage: 'writing' });
          if (pending) send({ t: 'delta', text: pending });
          pending = '';
        }
      }
    } else if (ev.type === 'response.completed' || ev.type === 'response.incomplete') {
      usage = ev.response.usage;
      if (ev.type === 'response.incomplete') console.warn('ask incomplete', ev.response.incomplete_details?.reason);
      for (const item of ev.response.output) {
        if (item.type !== 'message') continue;
        for (const part of item.content) {
          if (part.type === 'output_text') {
            text = part.text;
            annotations = part.annotations as Annotation[];
          }
        }
      }
    } else if (ev.type === 'response.failed' || ev.type === 'error') {
      throw new Error(`upstream ${ev.type}`);
    }
  }
  return { text, annotations, usage, searches, searchUrls: [...searchUrls], rawSources };
}

function logPass(n: number, p: Pass) {
  const citations = p.annotations.filter((a) => a.type === 'url_citation');
  const official = citations.filter((a) => a.url && isOfficialUrl(a.url));
  console.log('ask pass', JSON.stringify({
    pass: n,
    searched: p.searches > 0,
    searchSources: p.rawSources,
    officialSearchSources: p.searchUrls.length,
    citations: citations.length,
    officialCitations: official.length,
    textChars: p.text.length,
  }));
}

const NOT_FOUND_TEXT = /could ?n.?t find|could not (find|locate|confirm)|unable to (find|locate|confirm)|no official (page|source)|not (able|available) to (find|confirm)|नहीं मिल|nahi mil/i;

/** The model's text with links and markers removed, or null when it is a "could not find it" reply. */
function answerBody(text: string) {
  const plain = dropOffer(stripStrayLinks(text.replaceAll(DECLINE_TAG, '')))
    .replace(/\s*\(\s*\[([^\]]*)\]\(([^)\s]+)\)\s*\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/\s?\[\d{1,2}\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(\S) {2,}/g, '$1 ')
    .trim();
  if (plain.length < 120) return null;
  const firstPara = plain.split(/\n\s*\n/)[0];
  return NOT_FOUND_TEXT.test(firstPara) ? null : plain;
}

function searchSource(url: string, n: number): Source {
  const u = new URL(url);
  const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).at(-1) ?? '')
    .replace(/\.(html?|aspx|php|jsp|pdf)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  const title = last && !/^\d+$/.test(last) ? last.charAt(0).toUpperCase() + last.slice(1) : displayDomain(url);
  return { n, url, title: title.length > 90 ? `${title.slice(0, 87)}...` : title, domain: displayDomain(url) };
}

function noSource(quota: Quota | null, lang: Lang, question: string): Done {
  counters.noSource++;
  return { t: 'done', cached: false, quota, footer: FOOTER[lang], portal: null, kind: 'nosource', text: NOT_FOUND[lang], sources: [], related: portalsFor(question) };
}

function finish(quota: Quota | null, lang: Lang, question: string, text: string, annotations: Annotation[]): Done {
  const base = { t: 'done' as const, cached: false, quota, footer: FOOTER[lang], related: [] as Portal[], portal: null };
  if (text.includes(DECLINE_TAG)) {
    counters.declined++;
    const plain = text.replaceAll(DECLINE_TAG, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
    return { ...base, kind: 'decline', text: plain, sources: [], related: relatedPortals(question) };
  }
  const cited = applyCitations(text, annotations);
  if (!cited.sources.length) return { ...base, kind: 'nosource', text: '', sources: [] };
  const answer = dropOffer(cited.text);
  return { ...base, kind: 'answer', text: answer, sources: cited.sources, portal: bestPortal(question, answer) };
}
