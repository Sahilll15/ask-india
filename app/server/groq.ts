import OpenAI from 'openai';
import type { Annotation } from '../lib/citations.ts';
import { cleanUrl, isOfficialUrl, SEARCH_DOMAINS } from '../lib/domains.ts';

let client: OpenAI | null = null;

export const groqConfigured = () => Boolean(process.env.GROQ_API_KEY);
export const GROQ_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';
export const GROQ_TRANSCRIBE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL ?? 'whisper-large-v3-turbo';

export function groq() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  client ??= new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
    maxRetries: 0,
    timeout: 50_000,
  });
  return client;
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
  const res = await groq().chat.completions.create(
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
  );
  return groqPass((res.choices[0]?.message ?? {}) as GroqMessage);
}
