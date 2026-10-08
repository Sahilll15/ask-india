import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalIcon, ShieldIcon } from '../../components/Icons.tsx';
import { JsonLd } from '../../components/JsonLd.tsx';
import { PERSON_ID, SITE_URL, WEBSITE_ID, breadcrumbs, pageMetadata } from '../../lib/seo.ts';
import { GUIDES, LAST_CHECKED_ISO, LAST_CHECKED_LABEL, getGuide } from '../data.ts';

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  return pageMetadata({ title: guide.title, description: guide.description, path: `/guides/${guide.slug}` });
}

export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const url = `${SITE_URL}/guides/${guide.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: guide.title,
        description: guide.description,
        url,
        mainEntityOfPage: url,
        inLanguage: 'en-IN',
        datePublished: LAST_CHECKED_ISO,
        dateModified: LAST_CHECKED_ISO,
        author: { '@id': PERSON_ID },
        publisher: { '@id': PERSON_ID },
        isPartOf: { '@id': WEBSITE_ID },
        image: `${SITE_URL}/opengraph-image.png`,
        citation: guide.sources.map((s) => ({ '@type': 'WebPage', name: s.title, url: s.url })),
      },
      breadcrumbs([
        { name: 'Home', path: '/' },
        { name: 'Guides', path: '/guides' },
        { name: guide.title, path: `/guides/${guide.slug}` },
      ]),
    ],
  };

  const offsets = guide.sections.map((_, i) => guide.sections.slice(0, i).reduce((sum, sec) => sum + sec.steps.length, 0));
  return (
    <article className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <ol className="flex flex-wrap gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand hover:underline">
              Home
            </Link>{' '}
            /
          </li>
          <li>
            <Link href="/guides" className="hover:text-brand hover:underline">
              Guides
            </Link>
          </li>
        </ol>
      </nav>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{guide.title}</h1>
      <p className="mt-4 text-lg text-ink">{guide.summary}</p>
      <p className="mt-3 text-sm text-ink-soft">
        Last checked: <time dateTime={LAST_CHECKED_ISO}>{LAST_CHECKED_LABEL}</time>. Rules and fees change. Confirm every detail on the official
        page before you act.
      </p>

      <section aria-labelledby="needs" className="mt-8 rounded-3xl border border-line bg-card p-5 shadow-card sm:p-6">
        <h2 id="needs" className="text-xl font-bold tracking-tight">
          What you need
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink marker:text-brand">
          {guide.needs.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      {guide.sections.map((sec, si) => (
        <section key={sec.heading} className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight">{sec.heading}</h2>
          <ol className="mt-4 space-y-3" start={offsets[si] + 1}>
            {sec.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-ink">
                  {offsets[si] + i + 1}
                </span>
                <span className="pt-0.5 text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {guide.documents && (
        <section aria-labelledby="docs" className="mt-10">
          <h2 id="docs" className="text-2xl font-bold tracking-tight">
            Documents
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-ink marker:text-brand">
            {guide.documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="notes" className="mt-10">
        <h2 id="notes" className="text-2xl font-bold tracking-tight">
          Good to know
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-soft marker:text-brand">
          {guide.notes.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sources" className="mt-10 rounded-3xl border-2 border-brand bg-brand-tint p-5 sm:p-6">
        <h2 id="sources" className="flex items-center gap-2 font-semibold text-brand-deep">
          <ShieldIcon className="size-5" />
          Official sources
        </h2>
        <ul className="mt-3 space-y-2">
          {guide.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 font-medium text-ink hover:text-brand hover:underline">
                {s.title}
                <ExternalIcon className="mt-1 size-3.5 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-soft">
          Last checked: {LAST_CHECKED_LABEL}. Ask India is not a government website. Confirm on the official page before you act.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          href={`/?q=${encodeURIComponent(guide.followUp)}`}
          className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-deep"
        >
          Ask a follow-up question
        </Link>
        <span className="text-sm text-ink-soft">Opens the question box with &quot;{guide.followUp}&quot; filled in. You press Ask.</span>
      </div>
    </article>
  );
}
