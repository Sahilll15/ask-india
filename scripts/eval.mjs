// Runs eval/questions.json against a running server and checks every answer and every shown link.
// Usage: RATE_LIMIT_QUESTIONS=100 npm start, then BASE_URL=http://localhost:3206 npm run eval
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { isOfficialUrl } from '../app/lib/domains.ts';

const run = promisify(execFile);
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3206';
const IP = process.env.EVAL_IP ?? '203.0.113.50';
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 3);
const ONLY = process.env.EVAL_ONLY ? new RegExp(process.env.EVAL_ONLY, 'i') : null;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const questions = JSON.parse(readFileSync(new URL('../eval/questions.json', import.meta.url), 'utf8')).filter((q) => !ONLY || ONLY.test(q.question) || ONLY.test(q.topic));

async function status(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { stdout } = await run('curl', ['-sS', '-L', '--max-redirs', '5', '-o', '/dev/null', '--max-time', '20', '-A', UA, '-w', '%{http_code}', url]);
      if (stdout === '200' || attempt === 1) return stdout;
    } catch (err) {
      if (attempt === 1) return String(err.stdout || '000');
    }
  }
  return '000';
}

/** Share of letters that are Devanagari. */
function devanagari(text) {
  const letters = text.replace(/\[[^\]]*\]|https?:\S+/g, '').match(/\p{L}/gu) ?? [];
  return letters.length ? letters.filter((c) => /\p{Script=Devanagari}/u.test(c)).length / letters.length : 0;
}

async function ask(q) {
  const res = await fetch(`${BASE_URL}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': IP },
    body: JSON.stringify({ question: q.question }),
  });
  const events = (await res.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const done = events.find((e) => e.t === 'done');
  const meta = events.find((e) => e.t === 'meta');
  const fail = [];
  if (!done) return { q, kind: `http ${res.status}`, sources: 0, links: [], fail: [events.at(-1)?.error ?? `no answer (${res.status})`], meta: {} };

  if (done.kind !== q.expect) fail.push(`kind ${done.kind}, expected ${q.expect}`);
  if (q.expect === 'answer' && done.sources.length < 1) fail.push('no sources');
  if (meta?.lang !== q.lang) fail.push(`detected ${meta?.lang}, expected ${q.lang}`);
  const share = devanagari(done.text);
  if (q.lang === 'hi' ? share < 0.4 : share > 0.15) fail.push(`answer language off (devanagari ${share.toFixed(2)})`);

  const inline = [...done.text.matchAll(/\]\((https?:[^)\s]+)\)/g)].map((m) => m[1]);
  const urls = [...new Set([...done.sources.map((s) => s.url), ...(done.portal ? [done.portal.url] : []), ...(done.related ?? []).map((p) => p.url), ...inline])];
  const off = urls.filter((u) => !isOfficialUrl(u));
  if (off.length) fail.push(`non-official: ${off.join(' ')}`);
  const links = await Promise.all(urls.map(async (url) => ({ url, code: await status(url) })));
  for (const l of links) if (l.code !== '200') fail.push(`link ${l.code} ${l.url}`);
  return { q, kind: done.kind, sources: done.sources.length, links, fail, meta: done.meta ?? {} };
}

const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < questions.length) {
      const q = questions[next++];
      const r = await ask(q).catch((err) => ({ q, kind: 'error', sources: 0, links: [], fail: [String(err.message)], meta: {} }));
      results.push(r);
      console.error(`${r.fail.length ? 'FAIL' : 'pass'} ${q.question}${r.fail.length ? `  <- ${r.fail.join('; ')}` : ''}`);
    }
  }),
);

results.sort((a, b) => questions.indexOf(a.q) - questions.indexOf(b.q));
console.log('\n| # | Question | Kind | Sources | From | Links ok | Retried | Dropped | ms | Cost | Result |');
console.log('| - | - | - | - | - | - | - | - | - | - | - |');
results.forEach((r, i) => {
  const ok = r.links.filter((l) => l.code === '200').length;
  const m = r.meta;
  console.log(
    `| ${i + 1} | ${r.q.question} | ${r.kind} | ${r.sources} | ${m.sourcesFrom ?? '-'} | ${ok}/${r.links.length} | ${m.retried ? 'yes' : 'no'} | ${m.droppedLinks ?? '-'} | ${m.ms ?? '-'} | ${m.costUsd ?? (r.kind === 'answer' ? 'cached' : '-')} | ${r.fail.length ? `FAIL: ${r.fail.join('; ')}` : 'pass'} |`,
  );
});

const passed = results.filter((r) => !r.fail.length).length;
const allLinks = results.flatMap((r) => r.links);
const badLinks = allLinks.filter((l) => l.code !== '200');
const cost = results.reduce((s, r) => s + (r.meta.costUsd ?? 0), 0);
console.log(`\n${passed}/${results.length} passed (${Math.round((passed / results.length) * 100)}%), links ${allLinks.length - badLinks.length}/${allLinks.length} returned 200, cost $${cost.toFixed(3)}`);
process.exitCode = passed / results.length >= 0.9 && !badLinks.length ? 0 : 1;
