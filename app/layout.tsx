import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Fraunces, Mukta } from 'next/font/google';
import { Header } from './components/Header.tsx';
import './globals.css';

const mukta = Mukta({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-mukta',
});
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-fraunces', axes: ['opsz'] });

const siteUrl = 'https://askindia.online';
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
  authors: [{ name: 'Sahil Chalke', url: 'https://sahilchalke.com' }],
  creator: 'Sahil Chalke',
  openGraph: { type: 'website', siteName: 'Ask India', title, description, url: '/', locale: 'en_IN' },
  twitter: { card: 'summary_large_image', creator: '@chalke1015', title, description },
  robots: { index: true, follow: true },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Ask India',
  url: siteUrl,
  description,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  inLanguage: ['en-IN', 'hi'],
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  author: {
    '@type': 'Person',
    name: 'Sahil Chalke',
    url: 'https://sahilchalke.com',
    sameAs: ['https://github.com/Sahilll15', 'https://x.com/chalke1015'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2e9df' },
    { media: '(prefers-color-scheme: dark)', color: '#17110c' },
  ],
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mukta.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
        <a href="#main" className="sr-only rounded bg-ink px-3 py-2 text-page focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Not a government website. Not affiliated with the Government of India.{' '}
              <Link href="/about" className="font-medium text-brand underline-offset-4 hover:underline">
                Read the disclaimer
              </Link>
            </p>
            <p>
              Built by{' '}
              <a href="https://sahilchalke.com" className="font-medium text-ink underline-offset-4 hover:underline">
                Sahil Chalke
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
