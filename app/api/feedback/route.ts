import { counters } from '../../server/cache.ts';
import { bad, readJson } from '../../server/http.ts';
import { check, tooMany } from '../../server/ratelimit.ts';

export async function POST(req: Request) {
  const read = await readJson(req, 256);
  if (!read.ok) return read.res;
  const vote = (read.body as { vote?: unknown })?.vote;
  if (vote !== 'up' && vote !== 'down') return bad('vote must be "up" or "down".');
  const gate = check(req, 'feedback');
  if (!gate.ok) return tooMany(gate.retryAfter, 'feedback votes');
  counters[vote]++;
  return Response.json({ ok: true });
}

export function GET() {
  return Response.json(counters, { headers: { 'cache-control': 'no-store' } });
}
