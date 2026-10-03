'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { streamingView, type Source } from '../lib/citations.ts';
import { CATEGORIES, SAMPLES, type Portal } from '../lib/directory.ts';
import { redact, removedNotice, type RemovedKind } from '../lib/redact.ts';
import { Hexagons } from './Hexagons.tsx';
import {
  ArrowRightIcon,
  CategoryIcon,
  ClockIcon,
  ExternalIcon,
  EyeOffIcon,
  InfoIcon,
  MicIcon,
  SearchIcon,
  SendIcon,
  StopIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from './Icons.tsx';
import { Markdown } from './Markdown.tsx';
import { formatCountdown, useQuota } from './useQuota.ts';
import { MAX_SECONDS, useRecorder } from './useRecorder.ts';

const MAX_LEN = 500;

type Done = {
  kind: 'answer' | 'decline' | 'nosource';
  text: string;
  sources: Source[];
  related: Portal[];
  portal?: Portal | null;
  sourcesFrom?: 'citations' | 'search' | null;
  footer: string;
  cached: boolean;
  quota: { limit: number; remaining: number; resetAt: number | null } | null;
};

type Turn = {
  id: string;
  q: string;
  removed: RemovedKind[];
  status: 'streaming' | 'done' | 'error';
  stage: 'searching' | 'reading' | 'writing';
  domains: string[];
  text: string;
  done?: Done;
  error?: string;
  vote?: 'up' | 'down';
};

function shortUrl(raw: string) {
  const u = new URL(raw);
  const path = u.pathname.replace(/\/$/, '');
  return u.hostname.replace(/^www\./, '') + (path.length > 1 ? (path.length > 32 ? `/...${path.slice(-28)}` : path) : '');
}
const plain = (t: string) => t.replace(/\s?\[\d{1,2}\]/g, '');
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function AskApp() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const { quota, setQuota, spent, now } = useQuota();
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const autoAsked = useRef(false);

  const patch = useCallback((id: string, fn: (t: Turn) => Partial<Turn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)));
  }, []);

  const ask = useCallback(
    async (raw: string) => {
      if (busy || spent || !quota) return;
      const { text: q, removed } = redact(raw.trim().slice(0, MAX_LEN));
      if (q.replace(/\[[^\]]*removed\]/g, '').trim().length < 3) return;

      const id = crypto.randomUUID();
      const history = turns
        .filter((t) => t.done?.kind === 'answer')
        .slice(-3)
        .map((t) => ({ q: t.q, a: plain(t.done!.text).slice(0, 2000) }));
      setTurns((prev) => [...prev, { id, q, removed, status: 'streaming', stage: 'searching', domains: [], text: '' }]);
      setInput('');
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: q, history }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          if (res.status === 429 || json.code === 'daily_budget') {
            // Nothing partial: drop the turn entirely and give the question back.
            setTurns((prev) => prev.filter((t) => t.id !== id));
            setInput(raw);
            setQuota((prevQ) => ({
              limit: prevQ?.limit ?? 8,
              remaining: 0,
              resetAt: json.resetAt ?? prevQ?.resetAt ?? null,
              dailyExhausted: json.code === 'daily_budget',
            }));
            return;
          }
          patch(id, () => ({ status: 'error', error: json.error ?? 'Something went wrong. Try again.', text: '' }));
          return;
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = '';
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let nl: number;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const lineText = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!lineText) continue;
            const ev = JSON.parse(lineText);
            if (ev.t === 'meta') patch(id, (t) => ({ removed: [...new Set([...t.removed, ...(ev.removed ?? [])])] }));
            else if (ev.t === 'status') patch(id, (t) => ({ stage: ev.stage, domains: ev.domains ?? t.domains }));
            else if (ev.t === 'reset') patch(id, () => ({ stage: 'searching', text: '', domains: [] }));
            else if (ev.t === 'delta') patch(id, (t) => ({ stage: 'writing', text: t.text + ev.text }));
            else if (ev.t === 'done') {
              finished = true;
              patch(id, () => ({ status: 'done', done: ev, text: '' }));
              if (ev.quota) setQuota({ ...ev.quota, dailyExhausted: false });
            } else if (ev.t === 'error') {
              finished = true;
              patch(id, () => ({ status: 'error', error: ev.error, text: '' }));
            }
          }
        }
        if (!finished) patch(id, () => ({ status: 'error', error: 'The answer was cut off. Try again.', text: '' }));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          patch(id, () => ({ status: 'error', error: 'Could not reach Ask India. Check your connection and try again.', text: '' }));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, spent, quota, turns, patch, setQuota],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (autoAsked.current || !quota) return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (!q) return;
    autoAsked.current = true;
    window.history.replaceState(null, '', '/');
    if (spent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from a directory link
      setInput(q.slice(0, MAX_LEN));
      return;
    }
    void ask(q);
  }, [quota, spent, ask]);

  const lastId = turns.at(-1)?.id;
  useEffect(() => {
    if (lastId) document.getElementById(`turn-${lastId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [lastId]);

  const recorder = useRecorder(
    useCallback(({ text }: { text: string; removed: RemovedKind[] }) => {
      setInput(text);
      textRef.current?.focus();
    }, []),
  );

  const preview = input ? redact(input).removed : [];
  const disabled = spent || busy || !quota;
  const selected = CATEGORIES.find((c) => c.id === category);

  async function vote(id: string, v: 'up' | 'down') {
    patch(id, () => ({ vote: v }));
    try {
      await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vote: v }) });
    } catch {}
  }

  return (
    <>
      <section className="relative overflow-hidden">
        <Hexagons className="pointer-events-none absolute -right-24 -top-16 w-[520px] max-w-none opacity-40 sm:-right-10 sm:opacity-90" />
        <Hexagons className="pointer-events-none absolute -bottom-24 -left-28 w-[420px] max-w-none rotate-180 opacity-70" />

        <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6 sm:pt-16">
          <div className={turns.length ? 'mb-6' : 'mb-8 text-center'}>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-brand shadow-card sm:text-xs sm:tracking-[0.14em]">
              <SearchIcon className="size-3.5" />
              Answers from gov.in and nic.in pages only
            </p>
            <h1
              className={`font-display font-semibold tracking-tight text-ink transition-all ${
                turns.length ? 'text-3xl' : 'text-[2.4rem] leading-[1.05] sm:text-6xl'
              }`}
            >
              Ask how to get it done.
            </h1>
            {!turns.length && (
              <>
                <p className="mt-3 text-xl text-ink-soft" lang="hi">
                  सरकारी काम का सवाल पूछिए, आधिकारिक स्रोतों से जवाब पाइए।
                </p>
                <p className="mx-auto mt-4 max-w-xl text-base text-ink-soft">
                  PAN, Aadhaar, passport, ITR, driving licence and more. Short steps, the documents you need, and links to the exact
                  official page. In English, हिंदी or Hinglish.
                </p>
              </>
            )}
          </div>

          {turns.length > 0 && (
            <ol className="mb-6 space-y-8" aria-live="polite">
              {turns.map((t) => (
                <TurnView key={t.id} turn={t} onVote={vote} onRetry={() => ask(t.q)} canRetry={!disabled} />
              ))}
            </ol>
          )}

          {spent && quota && (
            <div role="status" className="mb-3 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn animate-rise">
              <ClockIcon className="mt-0.5 size-5 shrink-0" />
              {quota.dailyExhausted ? (
                <p>Ask India has used up its question budget for today. Try again tomorrow. The directory still works.</p>
              ) : (
                <p>
                  <span className="font-semibold">
                    You&apos;ve reached the hourly limit. It resets at {quota.resetAt ? timeOf(quota.resetAt) : 'the top of the hour'}
                  </span>
                  {quota.resetAt && <span className="tabular-nums"> (in {formatCountdown(quota.resetAt - now)})</span>}. The directory
                  still works.
                </p>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className={`rounded-3xl border bg-card p-2 shadow-lift transition-colors ${
              spent ? 'border-line opacity-70' : 'border-line-strong focus-within:border-brand'
            }`}
          >
            <label htmlFor="question" className="sr-only">
              Your question
            </label>
            <textarea
              id="question"
              ref={textRef}
              value={input}
              maxLength={MAX_LEN}
              disabled={spent}
              rows={2}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              placeholder={turns.length ? 'Ask a follow-up question' : 'e.g. How do I update my address in Aadhaar?'}
              className="block max-h-48 min-h-[3.5rem] w-full resize-none bg-transparent px-3 py-2.5 text-lg text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-2 px-1 pb-1">
              <button
                type="button"
                disabled={spent || recorder.state === 'transcribing'}
                onClick={() => (recorder.state === 'recording' ? recorder.stop() : recorder.start())}
                className={`flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                  recorder.state === 'recording'
                    ? 'recording border-brand bg-brand text-brand-ink'
                    : 'border-line text-ink-soft hover:border-brand hover:text-brand'
                }`}
                aria-label={recorder.state === 'recording' ? 'Stop recording' : 'Ask by voice, up to 30 seconds'}
              >
                {recorder.state === 'recording' ? <StopIcon className="size-4" /> : <MicIcon className="size-4" />}
                <span className="tabular-nums">
                  {recorder.state === 'recording'
                    ? `${formatCountdown(recorder.seconds * 1000)} / 0:${MAX_SECONDS}`
                    : recorder.state === 'transcribing'
                      ? 'Listening back...'
                      : 'Speak'}
                </span>
              </button>
              {input.length > 400 && <span className="text-xs tabular-nums text-ink-faint">{input.length}/{MAX_LEN}</span>}
              <button
                type="submit"
                disabled={disabled || !input.trim()}
                className="ml-auto flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink transition-all hover:bg-brand-deep active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? 'Answering...' : 'Ask'}
                <SendIcon className="size-4" />
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 text-sm text-ink-soft">
            <p className="flex items-center gap-1.5">
              <EyeOffIcon className="size-4 text-brand" />
              {preview.length ? (
                <span className="font-medium text-brand-deep">We will remove before sending: {preview.join(', ')}</span>
              ) : (
                <span>Aadhaar, PAN, phone and bank numbers are removed before anything is sent.</span>
              )}
            </p>
            {quota && !spent && (
              <p className="tabular-nums">
                <span className="font-semibold text-ink">{quota.remaining}</span> question{quota.remaining === 1 ? '' : 's'} left this hour
              </p>
            )}
          </div>
          {recorder.error && (
            <p role="alert" className="mt-2 px-2 text-sm text-warn">
              {recorder.error}
            </p>
          )}

          {!turns.length && (
            <div className="mt-7 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Try a sample</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLES.map((s) => (
                  <Chip key={s} text={s} disabled={disabled} onClick={() => ask(s)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="topics">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="topics" className="font-display text-2xl font-semibold tracking-tight">
              Browse by topic
            </h2>
            <p className="text-ink-soft" lang="hi">
              विषय के अनुसार देखें
            </p>
          </div>
          <Link href="/directory" className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            Full directory <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => {
            const on = c.id === category;
            return (
              <button
                key={c.id}
                type="button"
                aria-expanded={on}
                aria-controls="topic-panel"
                onClick={() => setCategory(on ? null : c.id)}
                className={`group flex min-h-32 flex-col items-start justify-between gap-3 rounded-3xl border p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift ${
                  on ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-card text-ink'
                }`}
              >
                <span
                  className={`grid size-11 place-items-center rounded-2xl transition-colors ${
                    on ? 'bg-brand-ink/15' : 'bg-brand-tint text-brand group-hover:bg-brand-wash'
                  }`}
                >
                  <CategoryIcon name={c.icon} className="size-6" />
                </span>
                <span>
                  <span className="block font-semibold leading-tight">{c.en}</span>
                  <span lang="hi" className={`block text-sm ${on ? 'opacity-85' : 'text-ink-soft'}`}>
                    {c.hi}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {selected && (
          <div id="topic-panel" className="mt-4 rounded-3xl border border-line bg-card p-5 shadow-card animate-rise">
            <p className="mb-3 text-sm font-semibold text-ink">
              Common questions about {selected.en.toLowerCase()} <span lang="hi" className="font-normal text-ink-soft">· {selected.hi}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.questions.map((q) => (
                <Chip key={q} text={q} disabled={disabled} onClick={() => ask(q)} />
              ))}
            </div>
            <Link href={`/directory#${selected.id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              Official portals for this topic <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

function Chip({ text, onClick, disabled }: { text: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-line-strong bg-card px-4 py-2 text-sm text-ink transition-all hover:-translate-y-0.5 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-line-strong disabled:hover:text-ink"
    >
      {text}
    </button>
  );
}

function TurnView({ turn, onVote, onRetry, canRetry }: { turn: Turn; onVote: (id: string, v: 'up' | 'down') => void; onRetry: () => void; canRetry: boolean }) {
  const d = turn.done;
  const anchor = `src-${turn.id.slice(0, 8)}`;
  return (
    <li id={`turn-${turn.id}`} className="scroll-mt-24 animate-rise">
      <div className="mb-3 flex flex-col items-end gap-1">
        <p className="max-w-[85%] rounded-3xl rounded-br-md bg-ink px-4 py-2.5 text-page">{turn.q}</p>
        {turn.removed.length > 0 && (
          <p className="flex items-center gap-1 text-xs font-medium text-brand-deep">
            <EyeOffIcon className="size-3.5" />
            {removedNotice(turn.removed)}
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-line bg-card p-5 shadow-card sm:p-6">
        {turn.status === 'streaming' && turn.stage !== 'writing' && (
          <div aria-busy="true">
            <p className="mb-4 flex items-center gap-2 text-sm font-medium text-ink-soft">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
              </span>
              {turn.stage === 'reading' && turn.domains.length
                ? `Reading ${turn.domains.join(', ')}`
                : 'Searching official sites'}
            </p>
            <div className="space-y-2.5">
              <div className="skeleton h-4 w-11/12" />
              <div className="skeleton h-4 w-9/12" />
              <div className="skeleton h-4 w-10/12" />
            </div>
          </div>
        )}

        {turn.status === 'streaming' && turn.stage === 'writing' && <Markdown text={streamingView(turn.text)} anchor={anchor} streaming />}

        {turn.status === 'error' && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-warn">{turn.error}</p>
            {canRetry && (
              <button type="button" onClick={onRetry} className="rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium hover:border-brand hover:text-brand">
                Try again
              </button>
            )}
          </div>
        )}

        {d?.kind === 'answer' && (
          <>
            <Markdown text={d.text} anchor={anchor} />
            {d.sourcesFrom === 'search' && <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Sources</p>}
            <div className={`${d.sourcesFrom === 'search' ? '' : 'mt-5 '}grid gap-2 sm:grid-cols-2`}>
              {d.sources.map((s) => (
                <a
                  key={s.n}
                  id={`${anchor}-${s.n}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-card group flex items-start gap-3 rounded-2xl border border-line bg-card p-3 transition-colors hover:border-brand"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-wash text-xs font-bold text-brand-deep">{s.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-brand">{s.title}</span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink-faint">
                      <span className="truncate">{shortUrl(s.url)}</span>
                      <ExternalIcon className="size-3" />
                    </span>
                  </span>
                </a>
              ))}
              {d.portal && (
                <a
                  href={d.portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-2xl border border-dashed border-line-strong bg-card p-3 transition-colors hover:border-brand"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-good-bg text-good">
                    <ExternalIcon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-faint">Official portal</span>
                    <span className="line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-brand">{d.portal.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-faint">{shortUrl(d.portal.url)}</span>
                  </span>
                </a>
              )}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-brand-tint px-3 py-2 text-sm text-brand-deep">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              {d.footer}
            </p>
          </>
        )}

        {d && d.kind !== 'answer' && (
          <div>
            <p className={`text-lg ${d.kind === 'nosource' ? 'font-semibold text-ink' : 'text-ink'}`}>{d.text}</p>
            {d.related.length > 0 && (
              <>
                {d.kind === 'decline' && <p className="mb-2 mt-4 text-sm text-ink-soft">Official places for procedures:</p>}
                <ul className={`grid gap-2 sm:grid-cols-3 ${d.kind === 'nosource' ? 'mt-3' : ''}`}>
                  {d.related.map((p) => (
                    <li key={p.url}>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-full flex-col rounded-2xl border border-line p-3 text-sm transition-colors hover:border-brand"
                      >
                        <span className="font-semibold text-ink">{p.name}</span>
                        <span className="text-xs text-ink-faint">{new URL(p.url).hostname.replace(/^www\./, '')}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {d.kind === 'nosource' && canRetry && (
              <button type="button" onClick={onRetry} className="mt-4 rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium hover:border-brand hover:text-brand">
                Try again
              </button>
            )}
          </div>
        )}

        {d && d.kind !== 'decline' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm text-ink-faint">
            {d.cached && (
              <span className="rounded-full bg-good-bg px-2.5 py-0.5 text-xs font-semibold text-good" title="Served from a recent identical question. Did not use your hourly quota.">
                Cached answer, did not use your quota
              </span>
            )}
            <span className="ml-auto">{turn.vote ? 'Thanks for the feedback.' : 'Was this useful?'}</span>
            {(['up', 'down'] as const).map((v) => (
              <button
                key={v}
                type="button"
                disabled={!!turn.vote}
                onClick={() => onVote(turn.id, v)}
                aria-label={v === 'up' ? 'Helpful' : 'Not helpful'}
                aria-pressed={turn.vote === v}
                className={`grid size-8 place-items-center rounded-full border transition-colors disabled:cursor-default ${
                  turn.vote === v ? 'border-brand bg-brand text-brand-ink' : 'border-line hover:border-brand hover:text-brand disabled:opacity-40'
                }`}
              >
                {v === 'up' ? <ThumbUpIcon className="size-4" /> : <ThumbDownIcon className="size-4" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
