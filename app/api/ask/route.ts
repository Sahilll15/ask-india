import { z } from 'zod';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import { applyCitations, DECLINE_TAG, dropOffer, type Annotation, type Source } from '../../lib/citations.ts';
import { relatedPortals, type Portal } from '../../lib/directory.ts';
import { displayDomain, isOfficialUrl, SEARCH_DOMAINS } from '../../lib/domains.ts';
import { detectLang, FOOTER, NOT_FOUND, type Lang } from '../../lib/lang.ts';
import { redact, type RemovedKind } from '../../lib/redact.ts';
import { answerCache, cacheKey, counters } from '../../server/cache.ts';
import { bad, readJson, upstreamError } from '../../server/http.ts';
import { estimateCost, openai, TEXT_MODEL } from '../../server/openai.ts';
import { instructions } from '../../server/prompts.ts';
import { budgetSpent, check, LIMITS, peek, questionBudget, tooMany } from '../../server/ratelimit.ts';

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
  footer: string;
  cached: boolean;
  quota: Quota;
  meta?: { ms: number; costUsd: number; searches: number; model: string };
};
type Quota = { limit: number; remaining: number; resetAt: number | null };

const encoder = new TextEncoder();
const line = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);
const STREAM_HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
  'x-accel-buffering': 'no',
};

function quotaFor(req: Request): Quota {
  return { limit: LIMITS.question.limit, ...peek(req, 'question') };
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
    const done: Done = { t: 'done', kind: 'answer', ...hit, related: [], cached: true, quota: quotaFor(req) };
    return new Response(new Blob([line({ t: 'meta', removed: [...removed], lang }), line(done)]).stream(), { headers: STREAM_HEADERS });
  }

  const gate = check(req, 'question');
  if (!gate.ok) return tooMany(gate.retryAfter, `${LIMITS.question.limit} questions`);
  if (!questionBudget.take()) return budgetSpent();
  counters.questions++;

  const input: ResponseInputItem[] = [
    ...history.flatMap((h): ResponseInputItem[] => [
      { role: 'user', content: h.q },
      { role: 'assistant', content: h.a },
    ]),
    { role: 'user', content: question },
  ];

  const started = Date.now();
  let upstream;
  try {
    upstream = await openai().responses.create({
      model: TEXT_MODEL,
      instructions: instructions(lang, new Date().toISOString().slice(0, 10)),
      input,
      tools: [
        {
          type: 'web_search',
          filters: { allowed_domains: SEARCH_DOMAINS },
          search_context_size: 'low',
          user_location: { type: 'approximate', country: 'IN' },
        },
      ],
      // Supported by the API but missing from this SDK version's create params type.
      ...({ max_tool_calls: MAX_SEARCHES } as object),
      include: ['web_search_call.action.sources'],
      reasoning: { effort: 'low' },
      max_output_tokens: 2500,
      store: false,
      stream: true,
    });
  } catch (err) {
    return upstreamError(err);
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(line(obj));
      send({ t: 'meta', removed: [...removed], lang });
      send({ t: 'status', stage: 'searching' });

      let pending = '';
      let open = false;
      let searches = 0;
      const seen = new Set<string>();
      let finalText = '';
      let finalAnnotations: Annotation[] = [];
      let usage;

      try {
        for await (const ev of upstream) {
          if (ev.type === 'response.output_item.done' && ev.item.type === 'web_search_call') {
            searches++;
            const action = ev.item.action as { sources?: { url?: string }[] } | undefined;
            for (const s of action?.sources ?? []) if (s.url && isOfficialUrl(s.url)) seen.add(displayDomain(s.url));
            if (seen.size) send({ t: 'status', stage: 'reading', domains: [...seen].slice(0, 4) });
          } else if (ev.type === 'response.output_text.delta') {
            // Nothing is shown until the first official citation arrives, so an unsourced answer never renders.
            if (open) send({ t: 'delta', text: ev.delta });
            else pending += ev.delta;
          } else if (ev.type === 'response.output_text.annotation.added') {
            const a = ev.annotation as Annotation;
            if (!open && a.type === 'url_citation' && a.url && isOfficialUrl(a.url)) {
              open = true;
              send({ t: 'status', stage: 'writing' });
              if (pending) send({ t: 'delta', text: pending });
              pending = '';
            }
          } else if (ev.type === 'response.completed' || ev.type === 'response.incomplete') {
            usage = ev.response.usage;
            if (ev.type === 'response.incomplete') console.warn('ask incomplete', ev.response.incomplete_details?.reason);
            for (const item of ev.response.output) {
              if (item.type !== 'message') continue;
              for (const part of item.content) {
                if (part.type === 'output_text') {
                  finalText = part.text;
                  finalAnnotations = part.annotations as Annotation[];
                }
              }
            }
          } else if (ev.type === 'response.failed' || ev.type === 'error') {
            throw new Error(`upstream ${ev.type}`);
          }
        }

        const done = finish(req, lang, question, finalText, finalAnnotations);
        const costUsd = estimateCost(usage, searches);
        done.meta = { ms: Date.now() - started, costUsd, searches, model: TEXT_MODEL };
        if (done.kind === 'answer' && key) {
          answerCache.set(key, { text: done.text, sources: done.sources, lang, footer: done.footer });
        }
        const counts = { textChars: finalText.length, annotations: finalAnnotations.length };
        console.log('ask', JSON.stringify({ kind: done.kind, lang, ms: done.meta.ms, costUsd, searches, sources: done.sources.length, ...counts }));
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

function finish(req: Request, lang: Lang, question: string, text: string, annotations: Annotation[]): Done {
  const base = { t: 'done' as const, cached: false, quota: quotaFor(req), footer: FOOTER[lang], related: [] as Portal[] };
  if (text.includes(DECLINE_TAG)) {
    counters.declined++;
    const plain = text.replaceAll(DECLINE_TAG, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
    return { ...base, kind: 'decline', text: plain, sources: [], related: relatedPortals(question) };
  }
  const cited = applyCitations(text, annotations);
  if (!cited.sources.length) {
    counters.noSource++;
    return { ...base, kind: 'nosource', text: NOT_FOUND[lang], sources: [], related: relatedPortals(question) };
  }
  return { ...base, kind: 'answer', text: dropOffer(cited.text), sources: cited.sources };
}
