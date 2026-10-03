import { counters } from '../../server/cache.ts';
import { bad, readJson } from '../../server/http.ts';
import { LimiterUnavailable, check, limiterBusy, tooMany } from '../../server/ratelimit.ts';

export const maxDuration = 60;

export async function POST(req: Request) {
  const read = await readJson(req, 256);
  if (!read.ok) return read.res;
  const vote = (read.body as { vote?: unknown })?.vote;
  if (vote !== 'up' && vote !== 'down') return bad('vote must be "up" or "down".');
  try {
    const gate = await check(req, 'feedback');
    if (!gate.ok) return tooMany(gate.retryAfter, 'feedback votes');
  } catch (err) {
    if (err instanceof LimiterUnavailable) return limiterBusy();
    throw err;
  }
  counters[vote]++;
  return Response.json({ ok: true });
}

export function GET() {
  return Response.json(counters, { headers: { 'cache-control': 'no-store' } });
}
