'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { ChevronIcon, LogoMark, MoonIcon, SunIcon } from './Icons.tsx';

const NAV = [
  { href: '/', label: 'Ask' },
  { href: '/guides', label: 'Guides' },
  { href: '/directory', label: 'Directory' },
  { href: '/about', label: 'About' },
];

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => obs.disconnect();
}
const getTheme = () => document.documentElement.dataset.theme ?? 'light';

export function Header() {
  const path = usePathname();
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light');

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-page/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="mr-4 flex items-center gap-2 rounded-lg"
          aria-label="Ask India home"
        >
          <LogoMark className="size-7" />
          <span className="whitespace-nowrap text-[1.1rem] font-semibold tracking-[-0.02em] text-ink">
            Ask India
          </span>
        </Link>
        <nav className="flex items-center" aria-label="Main">
          {NAV.filter((n) => n.href !== '/').map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`${n.href === '/about' ? 'hidden sm:block' : ''} rounded-lg px-2.5 py-1.5 text-[0.9375rem] font-medium transition-colors ${
                  active ? 'text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={toggle}
          className="ml-auto grid size-9 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-card-soft hover:text-ink"
          aria-label={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
        >
          {theme === 'dark' ? (
            <SunIcon className="size-[18px]" />
          ) : (
            <MoonIcon className="size-[18px]" />
          )}
        </button>
        <Link
          href="/#question"
          className="hidden h-9 items-center gap-1 rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-deep sm:inline-flex"
        >
          Ask a question
          <ChevronIcon className="size-4" />
        </Link>
      </div>
    </header>
  );
}
