import { CheckIcon, EyeOffIcon, MapPinIcon } from './Icons.tsx';

/** The flowing colour band behind the hero. Decorative only. */
export function Ribbon() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-[45%] -top-[22%] h-[760px] w-[760px] opacity-50 [mask-image:radial-gradient(closest-side,black_55%,transparent)] sm:-right-[14%] sm:-top-[38%] sm:h-[1200px] sm:w-[1200px] sm:opacity-100"
    >
      <svg viewBox="0 0 1000 1000" className="size-full animate-drift">
        <defs>
          <linearGradient id="rb-1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb45a" />
            <stop offset="0.55" stopColor="#ff6a7d" />
            <stop offset="1" stopColor="#f04aa8" />
          </linearGradient>
          <linearGradient id="rb-2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff7aa8" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="rb-3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7c83ff" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
          <filter id="rb-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <g filter="url(#rb-soft)" fill="none" strokeLinecap="round">
          <path
            d="M260 -80C420 260 620 420 1120 560"
            stroke="url(#rb-3)"
            strokeWidth="170"
            opacity="0.85"
          />
          <path
            d="M380 -80C530 300 700 480 1120 700"
            stroke="url(#rb-2)"
            strokeWidth="160"
            opacity="0.9"
          />
          <path
            d="M500 -80C640 330 780 560 1120 860"
            stroke="url(#rb-1)"
            strokeWidth="190"
            opacity="0.95"
          />
        </g>
        <g fill="none" strokeLinecap="round" opacity="0.45">
          <path
            d="M330 -60C480 290 670 460 1120 640"
            stroke="#fff"
            strokeWidth="5"
          />
        </g>
      </svg>
    </div>
  );
}

const PORTAL_NAMES = [
  'UIDAI',
  'Income Tax',
  'Passport Seva',
  'GST',
  'Parivahan',
  'DigiLocker',
  'EPFO',
];

export function PortalStrip() {
  return (
    <section aria-label="Official portals" className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:gap-10">
        <p className="shrink-0 text-sm text-ink-faint">
          Answers link to official portals like
        </p>
        <ul className="flex flex-wrap gap-x-8 gap-y-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-ink-soft lg:flex-1 lg:justify-between">
          {PORTAL_NAMES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Card({
  title,
  body,
  wide,
  children,
}: {
  title: string;
  body: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-card ${wide ? 'lg:col-span-2' : ''}`}
    >
      <div className="p-6 pb-0 sm:p-7 sm:pb-0">
        <h3 className="text-xl font-medium tracking-[-0.02em] text-ink">
          {title}
        </h3>
        <p className="mt-1.5 max-w-md leading-relaxed text-ink-soft">{body}</p>
      </div>
      <div className="relative mt-6 flex min-h-[230px] flex-1 items-end overflow-hidden px-6 sm:px-7">
        {children}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section
      className="border-b border-line bg-page-deep"
      aria-labelledby="features"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <h2
          id="features"
          className="two-tone max-w-3xl text-[1.9rem] font-medium leading-[1.12] tracking-[-0.03em] sm:text-[2.6rem]"
        >
          <span>Everything you need to get it done. </span>
          <span>
            Steps, documents and the right office, all from official sources.
          </span>
        </h2>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <Card
            wide
            title="Clear steps from official pages"
            body="Short steps, the documents you need and the fee, each linked to the gov.in page it came from."
          >
            <div className="absolute inset-0 bg-[radial-gradient(80%_90%_at_85%_100%,rgb(255_154_60/0.22),transparent_70%),radial-gradient(70%_80%_at_20%_110%,rgb(88_80_236/0.18),transparent_70%)]" />
            <div className="relative w-full max-w-lg translate-y-2 rounded-t-xl border border-b-0 border-line bg-card p-5 shadow-lift">
              <p className="font-medium text-ink">
                How do I update my address in Aadhaar?
              </p>
              <ol className="mt-3 space-y-2 text-sm text-ink-soft">
                {[
                  'Log in to myAadhaar with your mobile OTP.',
                  'Choose Address update and upload a proof.',
                  'Pay the fee and keep the request number.',
                ].map((t, i) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[0.7rem] font-semibold text-brand-ink">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2 pb-2">
                {['myaadhaar.uidai.gov.in', 'uidai.gov.in'].map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full bg-good-bg px-2.5 py-0.5 text-xs font-medium text-good"
                  >
                    <CheckIcon className="size-3" />
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card
            title="The right office near you"
            body="If a service needs a visit, open the nearest centre in Maps in one tap."
          >
            <svg
              className="absolute inset-0 size-full text-line-strong"
              aria-hidden
            >
              <defs>
                <pattern
                  id="streets"
                  width="56"
                  height="56"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(18)"
                >
                  <path
                    d="M0 28h56M28 0v56"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#streets)" />
            </svg>
            {[
              ['22%', '30%'],
              ['70%', '22%'],
              ['55%', '58%'],
            ].map(([left, top]) => (
              <span
                key={left}
                className="absolute grid size-8 place-items-center rounded-full bg-brand text-brand-ink shadow-lift"
                style={{ left, top }}
              >
                <MapPinIcon className="size-4" />
              </span>
            ))}
            <div className="relative mb-6 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-card p-3 shadow-lift">
              <span className="text-sm font-medium text-ink">
                Aadhaar Seva Kendra
              </span>
              <span className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink">
                Find near me
              </span>
            </div>
          </Card>

          <Card
            title="Ask in your language"
            body="English, हिंदी or Hinglish. Type it, or tap the mic and say it."
          >
            <div className="mb-6 flex w-full flex-col items-end gap-2">
              {[
                'How do I renew my passport?',
                'पासपोर्ट का नवीनीकरण कैसे करें?',
                'Passport renew kaise karein?',
              ].map((q) => (
                <span
                  key={q}
                  className="rounded-2xl rounded-br-md bg-brand-wash px-3.5 py-2 text-sm text-ink"
                >
                  {q}
                </span>
              ))}
            </div>
          </Card>

          <Card
            wide
            title="Your numbers stay on your phone"
            body="Aadhaar, PAN, phone and bank numbers are removed before your question is sent."
          >
            <div className="mb-6 grid w-full gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink-soft shadow-[var(--shadow)]">
                Change mobile on Aadhaar{' '}
                <span className="rounded bg-warn-bg px-1 font-medium text-warn">
                  2345 6789 0123
                </span>
              </div>
              <EyeOffIcon className="mx-auto size-5 text-ink-faint" />
              <div className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink-soft shadow-[var(--shadow)]">
                Change mobile on Aadhaar{' '}
                <span className="rounded bg-good-bg px-1 font-medium text-good">
                  [Aadhaar removed]
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
