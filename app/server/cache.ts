import type { Source } from '../lib/citations.ts';
import type { Lang } from '../lib/lang.ts';

export type CachedAnswer = { text: string; sources: Source[]; lang: Lang; footer: string; sourcesFrom?: 'citations' | 'search' | null };

const TTL_MS = 12 * 60 * 60 * 1000;

export function createAnswerCache(maxEntries = 500, ttlMs = TTL_MS) {
  const entries = new Map<string, { at: number; value: CachedAnswer }>();
  return {
    get(key: string, now = Date.now()) {
      const hit = entries.get(key);
      if (!hit) return null;
      if (now - hit.at >= ttlMs) {
        entries.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key: string, value: CachedAnswer, now = Date.now()) {
      entries.delete(key);
      entries.set(key, { at: now, value });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    },
    size: () => entries.size,
  };
}

/** Same question, different spacing, case or trailing punctuation maps to one key. */
export function cacheKey(question: string) {
  return question.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').replace(/[\s?.!।]+$/u, '').trim();
}

export const answerCache = createAnswerCache();

export const counters = { questions: 0, cached: 0, declined: 0, noSource: 0, up: 0, down: 0 };
