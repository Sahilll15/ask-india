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

export const metadata: Metadata = {
  metadataBase: new URL('https://askindia.online'),
  alternates: { canonical: '/' },
  title: { default: 'Ask India: answers from official government sites', template: '%s · Ask India' },
  description:
    'An independent Q&A front door to Indian government information. Ask how to get a PAN, update Aadhaar or renew a passport, and get short steps with links to the official pages. Not a government website.',
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
