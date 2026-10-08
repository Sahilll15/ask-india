'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { streamingView, type Source } from '../lib/citations.ts';
import { centreFor, mapsSearchUrl } from '../lib/centres.ts';
import { CATEGORIES, SAMPLES, type Portal } from '../lib/directory.ts';
import { redact, removedNotice, type RemovedKind } from '../lib/redact.ts';
import { hasDevanagari } from '../lib/seo.ts';
import {
  ArrowUpIcon,
  ChevronIcon,
  CategoryIcon,
  ClockIcon,
  ExternalIcon,
  EyeOffIcon,
  InfoIcon,
  MapPinIcon,
  MicIcon,
  StopIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from './Icons.tsx';
import { Features, PortalStrip, Ribbon } from './HomeSections.tsx';
import { Markdown } from './Markdown.tsx';
import { formatCountdown, useQuota } from './useQuota.ts';
import { MAX_SECONDS, useRecorder } from './useRecorder.ts';

const MAX_LEN = 500;

type Done = {
  kind: 'answer' | 'decline' | 'nosource';
  text: string;
  sources: Source[];
  related: Portal[];
  portals?: Portal[];
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
  return (
    u.hostname.replace(/^www\./, '') +
    (path.length > 1
      ? path.length > 32
        ? `/...${path.slice(-28)}`
        : path
      : '')
  );
}
const plain = (t: string) => t.replace(/\s?\[\d{1,2}\]/g, '');
const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function AskApp() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const { quota, setQuota, spent, now } = useQuota();
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

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
      setTurns((prev) => [
        ...prev,
        {
          id,
          q,
          removed,
          status: 'streaming',
          stage: 'searching',
          domains: [],
          text: '',
        },
      ]);
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
          patch(id, () => ({
            status: 'error',
            error: json.error ?? 'Something went wrong. Try again.',
            text: '',
          }));
          return;
        }

        const reader = res.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
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
            if (ev.t === 'meta')
              patch(id, (t) => ({
                removed: [...new Set([...t.removed, ...(ev.removed ?? [])])],
              }));
            else if (ev.t === 'status')
              patch(id, (t) => ({
                stage: ev.stage,
                domains: ev.domains ?? t.domains,
              }));
            else if (ev.t === 'reset')
              patch(id, () => ({ stage: 'searching', text: '', domains: [] }));
            else if (ev.t === 'delta')
              patch(id, (t) => ({ stage: 'writing', text: t.text + ev.text }));
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
        if (!finished)
          patch(id, () => ({
            status: 'error',
            error: 'The answer was cut off. Try again.',
            text: '',
          }));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          patch(id, () => ({
            status: 'error',
            error:
              'Could not reach Ask India. Check your connection and try again.',
            text: '',
          }));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, spent, quota, turns, patch, setQuota],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  // ?q= only prefills: a crawler or link preview must never spend a paid question.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (!q) return;
    window.history.replaceState(null, '', '/');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from a guide or directory link
    setInput(q.slice(0, MAX_LEN));
    textRef.current?.focus();
  }, []);

  const lastId = turns.at(-1)?.id;
  useEffect(() => {
    if (lastId)
      document
        .getElementById(`turn-${lastId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vote: v }),
      });
    } catch {}
  }

  const onHero = !turns.length;

  const form = (
    <>
      {spent && quota && (
        <div
          role="status"
          className="mb-3 flex items-start gap-3 rounded-2xl bg-warn-bg px-4 py-3 text-left text-sm text-warn animate-rise"
        >
          <ClockIcon className="mt-0.5 size-5 shrink-0" />
          {quota.dailyExhausted ? (
            <p>
              Ask India has used up its question budget for today. Try again
              tomorrow. The guides and directory still work.
            </p>
          ) : (
            <p>
              <span className="font-semibold">
                You&apos;ve reached the hourly limit. It resets at{' '}
                {quota.resetAt ? timeOf(quota.resetAt) : 'the top of the hour'}
              </span>
              {quota.resetAt && (
                <span className="tabular-nums">
                  {' '}
                  (in {formatCountdown(quota.resetAt - now)})
                </span>
              )}
              . The guides and directory still work.
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className={`rounded-2xl border bg-card shadow-[var(--shadow)] transition-[border-color,box-shadow] ${
          spent
            ? 'border-line opacity-70'
            : 'border-line-strong focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand/10'
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
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void ask(input);
            }
          }}
          placeholder={
            turns.length
              ? 'Ask a follow-up'
              : 'Ask anything about a government service'
          }
          className="field-sizing-content block max-h-48 min-h-[4.5rem] w-full scroll-mt-28 resize-none bg-transparent px-4 pb-1 pt-4 text-[1.0625rem] leading-6 text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-2 px-2.5 pb-2.5">
          <button
            type="button"
            disabled={spent || recorder.state === 'transcribing'}
            onClick={() =>
              recorder.state === 'recording'
                ? recorder.stop()
                : recorder.start()
            }
            className={`flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              recorder.state === 'recording'
                ? 'recording bg-brand text-brand-ink'
                : 'text-ink-soft hover:bg-card-soft hover:text-ink'
            }`}
            aria-label={
              recorder.state === 'recording'
                ? 'Stop recording'
                : 'Speak your question, up to 30 seconds'
            }
          >
            {recorder.state === 'recording' ? (
              <StopIcon className="size-4" />
            ) : (
              <MicIcon className="size-[18px]" />
            )}
            <span className="tabular-nums">
              {recorder.state === 'recording'
                ? `${formatCountdown(recorder.seconds * 1000)} / 0:${MAX_SECONDS}`
                : recorder.state === 'transcribing'
                  ? 'Listening...'
                  : 'Speak'}
            </span>
          </button>
          <span
            className={`hidden min-w-0 items-center gap-1.5 truncate text-xs sm:flex ${preview.length ? 'font-medium text-brand' : 'text-ink-faint'}`}
          >
            <EyeOffIcon className="size-3.5 shrink-0" />
            {preview.length
              ? `We will hide ${preview.join(', ')} before sending`
              : 'Personal numbers are hidden before sending'}
          </span>
          {input.length > 400 && (
            <span className="ml-auto text-xs tabular-nums text-ink-faint">
              {input.length}/{MAX_LEN}
            </span>
          )}
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            aria-label={busy ? 'Answering' : 'Ask'}
            className={`${input.length > 400 ? '' : 'ml-auto'} grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-ink transition-colors hover:bg-brand-deep active:scale-95 disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-ink-faint`}
          >
            {busy ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ArrowUpIcon className="size-[18px]" />
            )}
          </button>
        </div>
      </form>

      {quota && !spent && quota.remaining <= 3 && (
        <p className="mt-2 text-sm tabular-nums text-ink-faint">
          {quota.remaining} question{quota.remaining === 1 ? '' : 's'} left this
          hour.
        </p>
      )}
      {recorder.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-warn">
          {recorder.error}
        </p>
      )}
    </>
  );

  return (
    <>
      {onHero ? (
        <>
          <section className="relative overflow-hidden border-b border-line">
            <Ribbon />
            <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-24">
              <p className="text-sm font-medium text-ink-soft">
                Free to use. Ask in English, <span lang="hi">हिंदी</span> or
                Hinglish.
              </p>
              <h1 className="two-tone mt-5 max-w-3xl text-balance text-[2.2rem] font-medium leading-[1.08] tracking-[-0.035em] text-ink sm:text-[3.6rem]">
                <span className="sr-only">Ask India: </span>
                <span>Government work, made simple. </span>
                <span>
                  Ask about PAN, Aadhaar, passport or any service, and get clear
                  steps from official websites.
                </span>
              </h1>
              <div className="mt-9 max-w-2xl">{form}</div>
              <div className="mt-4 flex max-w-2xl flex-wrap gap-2">
                {SAMPLES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={disabled}
                    onClick={() => ask(q)}
                    lang={hasDevanagari(q) ? 'hi' : undefined}
                    className="rounded-full border border-line bg-card/80 px-3.5 py-1.5 text-sm text-ink-soft backdrop-blur transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <PortalStrip />
          <Features />
        </>
      ) : (
        <section className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
          <h1 className="sr-only">Ask India</h1>
          <ol
            className="mb-10 space-y-12 [&>li+li]:border-t [&>li+li]:border-line [&>li+li]:pt-12"
            aria-live="polite"
          >
            {turns.map((t) => (
              <TurnView
                key={t.id}
                turn={t}
                onVote={vote}
                onRetry={() => ask(t.q)}
                canRetry={!disabled}
              />
            ))}
          </ol>
          <div className="sticky bottom-4">{form}</div>
        </section>
      )}

      <section
        className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28"
        aria-labelledby="topics"
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <h2
            id="topics"
            className="two-tone max-w-2xl text-[1.9rem] font-medium leading-[1.12] tracking-[-0.03em] sm:text-[2.6rem]"
          >
            <span>Browse by topic. </span>
            <span>Common questions for each service.</span>
          </h2>
          <Link
            href="/directory"
            className="inline-flex items-center gap-1 text-[0.9375rem] font-medium text-brand hover:text-brand-deep"
          >
            All official websites <ChevronIcon className="size-4" />
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
                className={`flex flex-col items-start gap-6 rounded-2xl border bg-card p-4 text-left transition-[border-color,box-shadow] ${
                  on
                    ? 'border-brand ring-4 ring-brand/10'
                    : 'border-line hover:border-line-strong hover:shadow-[var(--shadow)]'
                }`}
              >
                <span
                  className={`grid size-9 place-items-center rounded-lg ${on ? 'bg-brand text-brand-ink' : 'bg-brand-tint text-brand'}`}
                >
                  <CategoryIcon name={c.icon} className="size-5" />
                </span>
                <span className="text-[0.9375rem] font-medium leading-tight tracking-tight text-ink">
                  {c.en}
                </span>
              </button>
            );
          })}
        </div>
        {selected && (
          <div
            id="topic-panel"
            className="mt-4 rounded-2xl border border-line bg-card px-5 py-3 shadow-[var(--shadow)] animate-rise"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
              <p className="font-medium text-ink">
                {selected.en}{' '}
                <span lang="hi" className="ml-1 font-normal text-ink-faint">
                  {selected.hi}
                </span>
              </p>
              <Link
                href={`/directory#${selected.id}`}
                className="text-sm font-medium text-brand hover:text-brand-deep"
              >
                Official websites
              </Link>
            </div>
            <QuestionList
              items={selected.questions}
              disabled={disabled}
              onAsk={ask}
            />
          </div>
        )}
      </section>
    </>
  );
}

function QuestionList({
  items,
  onAsk,
  disabled,
}: {
  items: string[];
  onAsk: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <ul className="divide-y divide-line">
      {items.map((q) => (
        <li key={q}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAsk(q)}
            lang={hasDevanagari(q) ? 'hi' : undefined}
            className="group flex w-full items-center justify-between gap-3 py-3.5 text-left text-ink transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            {q}
            <ChevronIcon className="size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function NearbyCentre({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const centre = centreFor(question, answer);
  if (!centre) return null;
  return (
    <div className="mt-5 rounded-2xl bg-card-soft p-4 sm:p-5">
      <p className="font-semibold text-ink">Want to go in person?</p>
      <p className="mt-0.5 text-sm text-ink-soft">
        Find the nearest {centre.name}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={mapsSearchUrl(centre)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-deep"
        >
          <MapPinIcon className="size-4" />
          Find near me
        </a>
        {centre.official && (
          <a
            href={centre.official.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            {centre.official.label}
            <ExternalIcon className="size-3.5" />
          </a>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        Find near me opens Google Maps, which is not an official source. Check
        timings before you go.
      </p>
    </div>
  );
}

function TurnView({
  turn,
  onVote,
  onRetry,
  canRetry,
}: {
  turn: Turn;
  onVote: (id: string, v: 'up' | 'down') => void;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const d = turn.done;
  const anchor = `src-${turn.id.slice(0, 8)}`;
  return (
    <li id={`turn-${turn.id}`} className="scroll-mt-24 animate-rise">
      <div className="mb-6">
        <h2
          className="text-[1.6rem] font-medium leading-tight tracking-[-0.025em] text-ink"
          lang={hasDevanagari(turn.q) ? 'hi' : undefined}
        >
          {turn.q}
        </h2>
        {turn.removed.length > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-brand">
            <EyeOffIcon className="size-3.5" />
            {removedNotice(turn.removed)}
          </p>
        )}
      </div>

      <div>
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

        {turn.status === 'streaming' && turn.stage === 'writing' && (
          <Markdown text={streamingView(turn.text)} anchor={anchor} streaming />
        )}

        {turn.status === 'error' && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-warn">{turn.error}</p>
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium hover:border-brand hover:text-brand"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {d?.kind === 'answer' && (
          <>
            <Markdown text={d.text} anchor={anchor} />
            {d.sourcesFrom === 'search' && (
              <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">
                Sources
              </p>
            )}
            <div
              className={`${d.sourcesFrom === 'search' ? '' : 'mt-5 '}grid gap-2 sm:grid-cols-2`}
            >
              {d.sources.map((s) => (
                <a
                  key={s.n}
                  id={`${anchor}-${s.n}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-card group flex min-w-0 items-start gap-3 rounded-2xl bg-card-soft p-3 transition-colors hover:bg-brand-tint"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-wash text-xs font-bold text-brand-deep">
                    {s.n}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-brand">
                      {s.title}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink-faint">
                      <span className="truncate">{shortUrl(s.url)}</span>
                      <ExternalIcon className="size-3" />
                    </span>
                  </span>
                </a>
              ))}
              {(d.portals ?? []).map((portal) => (
                <a
                  key={portal.url}
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-w-0 items-start gap-3 rounded-2xl bg-card-soft p-3 transition-colors hover:bg-brand-tint"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-good-bg text-good">
                    <ExternalIcon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-ink-faint">
                      Official portal
                    </span>
                    <span className="line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-brand">
                      {portal.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-faint">
                      {shortUrl(portal.url)}
                    </span>
                  </span>
                </a>
              ))}
            </div>
            <NearbyCentre question={turn.q} answer={d.text} />
            <p className="mt-4 flex items-start gap-2 text-sm text-ink-faint">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              {d.footer}
            </p>
          </>
        )}

        {d && d.kind !== 'answer' && (
          <div>
            <p
              className={`text-lg ${d.kind === 'nosource' ? 'font-semibold text-ink' : 'text-ink'}`}
            >
              {d.text}
            </p>
            {d.related.length > 0 && (
              <>
                {d.kind === 'decline' && (
                  <p className="mb-2 mt-4 text-sm text-ink-soft">
                    Official places for procedures:
                  </p>
                )}
                <ul
                  className={`grid gap-2 sm:grid-cols-3 ${d.kind === 'nosource' ? 'mt-3' : ''}`}
                >
                  {d.related.map((p) => (
                    <li key={p.url}>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-full flex-col rounded-2xl border border-line p-3 text-sm transition-colors hover:border-brand"
                      >
                        <span className="font-semibold text-ink">{p.name}</span>
                        <span className="text-xs text-ink-faint">
                          {new URL(p.url).hostname.replace(/^www\./, '')}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {d.kind === 'nosource' && canRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium hover:border-brand hover:text-brand"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {d && d.kind !== 'decline' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm text-ink-faint">
            {d.cached && (
              <span
                className="rounded-full bg-good-bg px-2.5 py-0.5 text-xs font-semibold text-good"
                title="Served from a recent identical question. Did not use your hourly quota."
              >
                Cached answer, did not use your quota
              </span>
            )}
            <span className="ml-auto">
              {turn.vote ? 'Thanks for the feedback.' : 'Was this useful?'}
            </span>
            {(['up', 'down'] as const).map((v) => (
              <button
                key={v}
                type="button"
                disabled={!!turn.vote}
                onClick={() => onVote(turn.id, v)}
                aria-label={v === 'up' ? 'Helpful' : 'Not helpful'}
                aria-pressed={turn.vote === v}
                className={`grid size-8 place-items-center rounded-full border transition-colors disabled:cursor-default ${
                  turn.vote === v
                    ? 'border-brand bg-brand text-brand-ink'
                    : 'border-line hover:border-brand hover:text-brand disabled:opacity-40'
                }`}
              >
                {v === 'up' ? (
                  <ThumbUpIcon className="size-4" />
                ) : (
                  <ThumbDownIcon className="size-4" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
