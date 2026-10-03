'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { LogoMark, MoonIcon, ShieldIcon, SunIcon } from './Icons.tsx';

const NAV = [
  { href: '/', label: 'Ask' },
  { href: '/guides', label: 'Guides' },
  { href: '/directory', label: 'Directory' },
  { href: '/about', label: 'About' },
];

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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
    <header className="sticky top-0 z-30 border-b border-line/70 bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Ask India home">
          <LogoMark className="size-7 sm:size-8" />
          <span className="font-display text-[1.15rem] font-semibold tracking-tight sm:text-[1.35rem]">Ask India</span>
        </Link>
        <span className="order-last flex w-full items-center justify-center gap-1.5 rounded-full border border-brand/25 bg-brand-tint px-3 py-1 text-xs font-medium text-brand-deep sm:order-none sm:w-auto">
          <ShieldIcon className="size-3.5" />
          Independent, not a government website
        </span>
        <nav className="ml-auto flex items-center gap-0.5 sm:gap-1" aria-label="Main">
          {NAV.map((n) => {
            const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`${n.href === '/' ? 'hidden sm:inline-block' : ''} rounded-full px-2.5 py-1.5 text-sm font-medium sm:px-3 transition-colors ${
                  active ? 'bg-ink text-page' : 'text-ink-soft hover:bg-card hover:text-ink'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={toggle}
            className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-card hover:text-ink"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
