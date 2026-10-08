import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon } from '../components/Icons.tsx';
import { JsonLd } from '../components/JsonLd.tsx';
import { SITE_URL, WEBSITE_ID, breadcrumbs, pageMetadata } from '../lib/seo.ts';
import { GUIDES, LAST_CHECKED_LABEL } from './data.ts';

const title = 'Guides to common Indian government services';
const description =
  'Short, plain guides to linking PAN with Aadhaar, getting an e-PAN, renewing a passport, updating your Aadhaar address, GST registration, EPF balance, voter ID and e-Aadhaar, each with official sources.';

export const metadata: Metadata = pageMetadata({ title, description, path: '/guides' });

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}/guides#page`,
      url: `${SITE_URL}/guides`,
      name: title,
      description,
      inLanguage: 'en-IN',
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: GUIDES.length,
        itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.title, url: `${SITE_URL}/guides/${g.slug}` })),
      },
    },
    breadcrumbs([
      { name: 'Home', path: '/' },
      { name: 'Guides', path: '/guides' },
    ]),
  ],
};

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <JsonLd data={jsonLd} />
      <p className="text-sm font-semibold text-ink-soft">
        Guides · <span lang="hi">मार्गदर्शिकाएं</span>
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Step-by-step guides</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Each guide is written from the official gov.in or nic.in pages it links to, and lists those pages as sources. Rules and fees change, so
        confirm on the official page before you act. Last checked: {LAST_CHECKED_LABEL}.
      </p>
      <ul className="mt-8 space-y-3">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guides/${g.slug}`}
              className="group flex items-start justify-between gap-4 rounded-3xl border border-line bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-lift"
            >
              <span>
                <span className="block font-semibold text-ink group-hover:text-brand">{g.title}</span>
                <span className="mt-1 block text-sm text-ink-soft">{g.summary}</span>
              </span>
              <ArrowRightIcon className="mt-1 size-5 shrink-0 text-ink-faint group-hover:text-brand" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
