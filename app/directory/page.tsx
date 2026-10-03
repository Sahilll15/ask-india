import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES, FEATURED_PORTALS, PORTALS } from '../lib/directory.ts';
import { displayDomain } from '../lib/domains.ts';
import { ArrowRightIcon, CategoryIcon, ExternalIcon } from '../components/Icons.tsx';
import { Hexagons } from '../components/Hexagons.tsx';
import { JsonLd } from '../components/JsonLd.tsx';
import { GUIDES, guideForQuestion } from '../guides/data.ts';
import { SITE_URL, WEBSITE_ID, breadcrumbs, hasDevanagari, pageMetadata } from '../lib/seo.ts';

const title = 'Indian government services directory: PAN, Aadhaar, passport, GST';
const description =
  'Official portals and common questions for PAN, Aadhaar, passport, GST, EPF, voter ID, driving licence and more, with links to incometax.gov.in, uidai.gov.in, passportindia.gov.in and gst.gov.in.';

export const metadata: Metadata = pageMetadata({ title, description, path: '/directory', absoluteTitle: true });

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}/directory#page`,
      url: `${SITE_URL}/directory`,
      name: title,
      description,
      inLanguage: 'en-IN',
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: {
        '@type': 'ItemList',
        name: 'Official Indian government portals',
        numberOfItems: FEATURED_PORTALS.length,
        itemListElement: FEATURED_PORTALS.map((k, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: PORTALS[k].name,
          url: PORTALS[k].url,
        })),
      },
    },
    breadcrumbs([
      { name: 'Home', path: '/' },
      { name: 'Directory', path: '/directory' },
    ]),
  ],
};

export default function DirectoryPage() {
  return (
    <div className="relative overflow-x-clip">
      <Hexagons className="pointer-events-none absolute -right-24 -top-10 w-[460px] max-w-none opacity-80" />
      <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
        <JsonLd data={jsonLd} />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
          Directory · <span lang="hi">निर्देशिका</span>
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Where to start</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Pick a topic to ask a common question, or go straight to the official portal. Every link below points to a gov.in or nic.in site and was
          checked to load.
        </p>

        <section aria-labelledby="guides" className="mt-6 rounded-3xl border border-line bg-card p-5 shadow-card">
          <h2 id="guides" className="font-semibold">
            Step-by-step guides
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="inline-block rounded-full bg-page px-3 py-1.5 text-sm text-ink-soft transition-colors hover:text-brand">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <nav aria-label="Topics" className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand hover:text-brand">
              {c.en}
            </a>
          ))}
        </nav>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {CATEGORIES.map((c) => (
            <section key={c.id} id={c.id} className="scroll-mt-24 rounded-3xl border border-line bg-card p-5 shadow-card sm:p-6" aria-labelledby={`${c.id}-h`}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-tint text-brand">
                  <CategoryIcon name={c.icon} className="size-6" />
                </span>
                <div>
                  <h2 id={`${c.id}-h`} className="font-semibold leading-tight">
                    {c.en}
                  </h2>
                  <p lang="hi" className="text-sm text-ink-soft">
                    {c.hi}
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-1">
                {c.questions.map((q) => {
                  const guide = guideForQuestion(q);
                  return (
                    <li key={q}>
                      <Link
                        href={guide ? `/guides/${guide.slug}` : `/?q=${encodeURIComponent(q)}`}
                        lang={hasDevanagari(q) ? 'hi' : undefined}
                        className="group flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-ink transition-colors hover:bg-brand-tint hover:text-brand-deep"
                      >
                        <span>
                          {q}
                          {guide && (
                            <span lang="en" className="ml-2 rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand-deep">
                              Guide
                            </span>
                          )}
                        </span>
                        <ArrowRightIcon className="size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {c.portals.map((k) => (
                  <a
                    key={k}
                    href={PORTALS[k].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-page px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:text-brand"
                  >
                    {PORTALS[k].name}
                    <ExternalIcon className="size-3" />
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14" aria-labelledby="portals">
          <h2 id="portals" className="font-display text-3xl font-semibold tracking-tight">
            Go straight to a service
          </h2>
          <p lang="hi" className="text-ink-soft">
            सीधे सेवा पर जाएं
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_PORTALS.map((k) => {
              const p = PORTALS[k];
              return (
                <li key={k}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full flex-col rounded-3xl border border-line bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-lift"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-ink group-hover:text-brand">{p.name}</span>
                      <ExternalIcon className="size-4 shrink-0 text-ink-faint group-hover:text-brand" />
                    </span>
                    <span lang="hi" className="text-sm text-ink-soft">
                      {p.hi}
                    </span>
                    <span className="mt-2 text-sm text-ink-soft">{p.what}</span>
                    <span className="mt-auto pt-3 text-xs font-medium text-ink-faint">{displayDomain(p.url)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
