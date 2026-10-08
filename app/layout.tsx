import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Geist, Noto_Sans_Devanagari } from 'next/font/google';
import { Header } from './components/Header.tsx';
import { LogoMark } from './components/Icons.tsx';
import { JsonLd } from './components/JsonLd.tsx';
import { PERSON_ID, SITE_URL, WEBSITE_ID } from './lib/seo.ts';
import './globals.css';

// Geist has no Devanagari glyphs, so Hindi text falls back to Noto per character.
const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});
const deva = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  display: 'swap',
  variable: '--font-deva',
  preload: false,
});

const siteUrl = SITE_URL;
const title = 'Ask India: answers from official government sites';
const description =
  'Ask how to link PAN and Aadhaar, renew a passport or register for GST, and get short steps with links to official gov.in pages. Not a government website.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  title: { default: title, template: '%s · Ask India' },
  description,
  keywords: [
    'PAN Aadhaar link',
    'passport renewal steps',
    'GST registration process',
    'government services India',
    'Aadhaar address update',
    'how to apply for PAN card',
    'ITR filing steps',
    'Udyam registration',
    'आधार अपडेट',
    'पैन आधार लिंक',
  ],
  applicationName: 'Ask India',
  appleWebApp: { capable: true, title: 'Ask India', statusBarStyle: 'default' },
  authors: [{ name: 'Sahil Chalke', url: 'https://sahilchalke.com' }],
  creator: 'Sahil Chalke',
  openGraph: {
    type: 'website',
    siteName: 'Ask India',
    title,
    description,
    url: '/',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@chalke1015',
    title,
    description,
  },
  robots: { index: true, follow: true },
};

const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Sahil Chalke',
  url: 'https://sahilchalke.com',
  sameAs: ['https://github.com/Sahilll15', 'https://x.com/chalke1015'],
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'Ask India',
      alternateName: 'AskIndia',
      url: siteUrl,
      description,
      inLanguage: ['en-IN', 'hi'],
      publisher: { '@id': PERSON_ID },
      author: { '@id': PERSON_ID },
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#app`,
      name: 'Ask India',
      url: siteUrl,
      description,
      isPartOf: { '@id': WEBSITE_ID },
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      inLanguage: ['en-IN', 'hi'],
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      author: { '@id': PERSON_ID },
    },
    person,
  ],
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${deva.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <JsonLd data={jsonLd} />
        <a
          href="#main"
          className="sr-only rounded bg-ink px-3 py-2 text-page focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
        >
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <footer className="border-t border-line bg-page-deep">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2"
                aria-label="Ask India home"
              >
                <LogoMark className="size-7" />
                <span className="text-[1.1rem] font-semibold tracking-[-0.02em] text-ink">
                  Ask India
                </span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
                Simple steps for government services in India, taken from
                official websites.
              </p>
            </div>
            <FooterColumn
              title="Use"
              links={[
                ['/', 'Ask a question'],
                ['/guides', 'Step-by-step guides'],
                ['/directory', 'Official websites'],
              ]}
            />
            <FooterColumn
              title="About"
              links={[
                ['/about', 'How it works'],
                ['/about', 'Disclaimer'],
                [
                  'https://github.com/Sahilll15/ask-india/issues/new',
                  'Report a mistake',
                ],
              ]}
            />
          </div>
          <div className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-faint sm:flex-row sm:justify-between sm:px-6">
              <p>
                Not a government website. Not affiliated with the Government of
                India.
              </p>
              <p>
                Built by{' '}
                <a
                  href="https://sahilchalke.com"
                  className="font-medium text-ink-soft hover:text-ink"
                >
                  Sahil Chalke
                </a>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={label}>
            <Link
              href={href}
              className="text-ink-soft transition-colors hover:text-ink"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
