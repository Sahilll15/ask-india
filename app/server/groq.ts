import OpenAI from 'openai';
import type { Annotation } from '../lib/citations.ts';
import { cleanUrl, isOfficialUrl, SEARCH_DOMAINS } from '../lib/domains.ts';

type Env = Record<string, string | undefined>;

/** GROQ_API_KEY first, then GROQ_API_KEYS (comma or newline separated), deduped. */
export function groqKeys(env: Env = process.env) {
  const all = [env.GROQ_API_KEY ?? '', ...(env.GROQ_API_KEYS ?? '').split(/[,\n]/)].map((k) => k.trim()).filter(Boolean);
  return [...new Set(all)];
}

export const groqConfigured = () => groqKeys().length > 0;
export const GROQ_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';
export const GROQ_TRANSCRIBE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL ?? 'whisper-large-v3-turbo';

const clients = new Map<string, OpenAI>();
const parked = new Map<string, number>();

function groqClient(key: string) {
  let c = clients.get(key);
  if (!c) {
    c = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1', maxRetries: 0, timeout: 50_000 });
    clients.set(key, c);
  }
  return c;
}

/** How long Groq asked us to wait (header, else the "try again in 6m6.7s" text, else a minute), kept between 1s and a day. */
export function retryAfterMs(err: unknown) {
  return Math.min(Math.max(rawRetryAfterMs(err), 1_000), 86_400_000);
}

function rawRetryAfterMs(err: unknown) {
  const headers = (err as { headers?: Headers | Record<string, string> })?.headers;
  const header = headers instanceof Headers ? headers.get('retry-after') : headers?.['retry-after'];
  if (header && Number.isFinite(Number(header))) return Number(header) * 1000;
  const m = (err as Error)?.message?.match(/try again in (?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?/i);
  if (m && m.slice(1).some(Boolean)) {
    const [h, min, sec, ms] = m.slice(1).map((v) => Number(v ?? 0));
    return Math.round(h * 3_600_000 + min * 60_000 + sec * 1000 + ms);
  }
  return 60_000;
}

/**
 * Runs `call` on each Groq key that is not parked. A rate limited or rejected key is parked and the next one is tried;
 * an outage (5xx, network) is the same for every key, so it is thrown for the OpenAI fallback to handle.
 */
export async function withGroqKeys<T, C = OpenAI>(
  call: (client: C) => Promise<T>,
  opts: { keys?: string[]; cool?: Map<string, number>; now?: () => number; make?: (key: string) => C } = {},
): Promise<T> {
  const keys = opts.keys ?? groqKeys();
  const cool = opts.cool ?? parked;
  const now = opts.now ?? Date.now;
  const make = opts.make ?? (groqClient as unknown as (key: string) => C);
  let last: unknown = Object.assign(new Error('Every Groq key is resting after a rate limit'), { status: 429 });
  for (const [i, key] of keys.entries()) {
    if ((cool.get(key) ?? 0) > now()) continue;
    try {
      return await call(make(key));
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 429 || status === 413) cool.set(key, now() + retryAfterMs(err));
      else if (status === 401 || status === 403) cool.set(key, now() + 3_600_000);
      else throw err;
      console.warn(`groq key ${i + 1} of ${keys.length} ${status === 401 || status === 403 ? 'rejected' : 'rate limited'}`);
      last = err;
    }
  }
  throw last;
}

/** Rate limits (429, or 413 when one request exceeds the per-minute budget), server errors and network failures are worth one try on OpenAI. */
export function retryableUpstream(err: unknown) {
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number') return status === 429 || status === 413 || status >= 500;
  return true;
}

type ExecutedTool = {
  type?: string;
  output?: string | null;
  search_results?: { results?: { url?: string }[] } | null;
};
export type GroqMessage = {
  content?: string | null;
  executed_tools?: ExecutedTool[] | null;
};

/** The page a browser tool result shows: its URL and title, read from the numbered text the tool returns. */
function pageOf(output: string) {
  const lines = output
    .split('\n')
    .slice(0, 8)
    .map((l) => l.replace(/^L\d+:\s?/, '').trim());
  const at = lines.findIndex((l) => l.startsWith('URL:'));
  if (at < 0) return null;
  const inline = lines[at].slice(4).trim();
  const url = inline || lines[at + 1] || '';
  if (!/^https?:\/\//.test(url)) return null;
  const title = lines.slice(at + (inline ? 1 : 2)).find(Boolean) ?? '';
  return { url, title };
}

/**
 * Converts a Groq browser-search reply into the shape the OpenAI path produces.
 * Each 【N†Lx-Ly】 marker cites the Nth page the browser showed, so it becomes a url_citation at that spot.
 */
export function groqPass(message: GroqMessage) {
  const tools = message.executed_tools ?? [];
  const pages = tools.map((t) => (t.output ? pageOf(t.output) : null)).filter((p): p is { url: string; title: string } => p !== null);
  const searches = tools.filter((t) => t.type === 'browser_search').length;

  const searchUrls = new Set<string>();
  for (const t of tools) {
    for (const r of t.search_results?.results ?? []) if (r.url && isOfficialUrl(r.url)) searchUrls.add(cleanUrl(r.url));
    const page = t.type !== 'browser_search' && t.output ? pageOf(t.output) : null;
    if (page && isOfficialUrl(page.url)) searchUrls.add(cleanUrl(page.url));
  }

  const annotations: Annotation[] = [];
  let text = '';
  let last = 0;
  const raw = message.content ?? '';
  for (const m of raw.matchAll(/\s?【(\d+)†[^】]*】/g)) {
    text += raw.slice(last, m.index);
    last = m.index + m[0].length;
    const page = pages[Number(m[1])];
    if (page)
      annotations.push({
        type: 'url_citation',
        url: page.url,
        title: page.title,
        start_index: text.length,
        end_index: text.length,
      });
  }
  text += raw.slice(last);

  return {
    text: text.trim(),
    annotations,
    searches,
    searchUrls: [...searchUrls],
    rawSources: searchUrls.size,
  };
}

/** One answer from gpt-oss with Groq's browser search, limited to the official domains. */
export async function askGroq(opts: {
  instructions: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  forced: boolean;
  signal: AbortSignal;
}) {
  const res = await withGroqKeys((client) =>
    client.chat.completions.create(
      {
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: opts.instructions }, ...opts.messages],
        tools: [{ type: 'browser_search' }] as unknown as OpenAI.Chat.ChatCompletionTool[],
        tool_choice: opts.forced ? 'required' : 'auto',
        max_completion_tokens: 2500,
        ...({
          reasoning_effort: 'low',
          search_settings: {
            include_domains: SEARCH_DOMAINS.flatMap((d) => [d, `*.${d}`]),
          },
        } as object),
      },
      { signal: opts.signal },
    ),
  );
  return groqPass((res.choices[0]?.message ?? {}) as GroqMessage);
}
