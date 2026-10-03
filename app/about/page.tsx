import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldIcon } from '../components/Icons.tsx';
import { JsonLd } from '../components/JsonLd.tsx';
import { PERSON_ID, SITE_URL, WEBSITE_ID, breadcrumbs, pageMetadata } from '../lib/seo.ts';

const description = 'What Ask India is, how it answers, what it does with your data, and what it is not. An independent project, not a government website.';

export const metadata: Metadata = pageMetadata({ title: 'About Ask India and how it answers', description, path: '/about' });

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      '@id': `${SITE_URL}/about#page`,
      url: `${SITE_URL}/about`,
      name: 'About Ask India',
      description,
      inLanguage: 'en-IN',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': WEBSITE_ID },
      author: { '@id': PERSON_ID },
    },
    breadcrumbs([
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about' },
    ]),
  ],
};

const STEPS = [
  ['You ask', 'In English, Hindi or Hinglish, typed or spoken (up to 30 seconds).'],
  ['Your browser strips IDs', 'Aadhaar, PAN, voter ID, passport, phone, email, IFSC, account and card numbers are replaced before the question leaves your device. The server runs the same check again.'],
  ['Search official sites only', 'The model can only search gov.in and nic.in websites. Every citation is checked again in code, and anything not on an official host is dropped.'],
  ['Answer with sources', 'Steps, documents and fees only where an official page states them, each with a numbered link. If no official source backs the answer, you see that instead of a guess.'],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <JsonLd data={jsonLd} />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
        About · <span lang="hi">परिचय</span>
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">A front door, not the office</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Ask India is an independent project. You ask how to do something with the government, like getting a PAN, updating your Aadhaar
        address or filing a grievance, and it gives you a short answer with steps, the documents needed, fees when the official page lists
        them, and links to the exact official pages.
      </p>

      <section aria-labelledby="disclaimer" className="mt-8 rounded-3xl border-2 border-brand bg-brand-tint p-6">
        <h2 id="disclaimer" className="flex items-center gap-2 text-lg font-bold text-brand-deep">
          <ShieldIcon className="size-5" />
          Please read this
        </h2>
        <ul className="mt-3 space-y-1.5 text-lg font-medium text-ink">
          <li>Not a government website.</li>
          <li>Not affiliated with the Government of India or any department.</li>
          <li>Cannot submit applications or check your records.</li>
          <li>Not legal, tax or financial advice.</li>
        </ul>
        <p className="mt-3 text-ink-soft">
          Rules, fees and dates change. Always confirm on the linked official page before you act. Answers are written by an AI model from those
          pages and can be wrong.
        </p>
      </section>

      <section aria-labelledby="how" className="mt-12">
        <h2 id="how" className="font-display text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-5 space-y-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-bold text-brand-ink">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="privacy" className="mt-12">
        <h2 id="privacy" className="font-display text-2xl font-semibold tracking-tight">
          Privacy
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-soft marker:text-brand">
          <li>ID numbers, phone numbers, emails and bank details are removed in your browser before sending, and again on the server. You see a note saying what was removed.</li>
          <li>Questions and answers are not saved by Ask India. They are sent to OpenAI with response storage turned off, and OpenAI&apos;s own data policy applies. Your follow-up context lives only in your browser tab.</li>
          <li>To save cost, an identical first question (after redaction) may be answered from memory for up to 12 hours. That copy is held in server memory only and is never written to disk.</li>
          <li>Voice recordings go to OpenAI for transcription and are not saved by Ask India. The transcript is redacted before it is used.</li>
          <li>The only things kept are anonymous counters: number of questions, thumbs up and thumbs down. No text is stored with a vote.</li>
          <li>Your IP address is held in memory for up to an hour to apply the hourly question limit.</li>
        </ul>
      </section>

      <section aria-labelledby="neutral" className="mt-12">
        <h2 id="neutral" className="font-display text-2xl font-semibold tracking-tight">
          Neutrality
        </h2>
        <p className="mt-3 text-ink-soft">
          Ask India does not answer questions about political parties, candidates or campaigns, and does not offer opinions on government
          performance. For elections it only explains official Election Commission of India procedures, such as registering to vote, getting a voter
          ID or finding your polling station.
        </p>
      </section>

      <section aria-labelledby="limits" className="mt-12">
        <h2 id="limits" className="font-display text-2xl font-semibold tracking-tight">
          Limits
        </h2>
        <p className="mt-3 text-ink-soft">
          This is a free demo that runs on its builder&apos;s own API credits, so each visitor gets a few questions per hour and the site has a daily
          cap. The <Link href="/directory" className="font-medium text-brand hover:underline">directory</Link> is always available.
        </p>
      </section>

      <p className="mt-12 rounded-2xl bg-card px-5 py-4 text-ink-soft shadow-card">
        Built by{' '}
        <a href="https://sahilchalke.com" className="font-semibold text-brand hover:underline">
          Sahil Chalke
        </a>
        . Inspired by an independent Q&amp;A site for Pakistan government information.
      </p>

      <p className="mt-4 px-1 text-ink-soft">
        Found a mistake in an answer or a guide?{' '}
        <a href="https://github.com/Sahilll15/ask-india/issues/new" className="font-medium text-brand hover:underline">
          Report it on GitHub
        </a>
        .
      </p>
    </div>
  );
}
