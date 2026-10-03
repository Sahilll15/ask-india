import Link from 'next/link';
import { AskApp } from './components/AskApp.tsx';
import { ArrowRightIcon } from './components/Icons.tsx';
import { GUIDES } from './guides/data.ts';

export default function Home() {
  return (
    <>
      <AskApp />
      <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6" aria-labelledby="home-guides">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 id="home-guides" className="font-display text-2xl font-semibold tracking-tight">
            Step-by-step guides
          </h2>
          <Link href="/guides" className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            All guides <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="flex h-full items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm font-medium text-ink shadow-card transition-colors hover:border-brand hover:text-brand"
              >
                {g.title}
                <ArrowRightIcon className="size-4 shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
