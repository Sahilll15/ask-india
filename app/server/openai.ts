import OpenAI from 'openai';

let client: OpenAI | null = null;

export function openai() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  client ??= new OpenAI({ maxRetries: 1, timeout: 50_000 });
  return client;
}

export const TEXT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';
export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? 'gpt-4o-mini-transcribe';

// USD per 1M tokens and per search call, for the cost estimate in logs and response meta.
const PRICES: Record<string, { input: number; cached: number; output: number }> = {
  'gpt-5.4-mini': { input: 0.75, cached: 0.075, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, cached: 0.02, output: 1.25 },
  'gpt-5.5': { input: 5, cached: 0.5, output: 30 },
};
const SEARCH_CALL_USD = 0.01;

export function estimateCost(usage: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } } | undefined, searches: number) {
  const p = PRICES[TEXT_MODEL] ?? PRICES['gpt-5.4-mini'];
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const input = (usage?.input_tokens ?? 0) - cached;
  const usd = (input * p.input + cached * p.cached + (usage?.output_tokens ?? 0) * p.output) / 1e6 + searches * SEARCH_CALL_USD;
  return Math.round(usd * 10000) / 10000;
}
