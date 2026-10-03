import type { IconName } from '../lib/directory.ts';

type P = { className?: string };
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const PATHS: Record<IconName, React.ReactNode> = {
  id: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.8 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 9.5h4M14.5 12.5h3" />
    </>
  ),
  tax: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M15 3v3h3M9 10h6M9 13.5h6M9 17h3.5" />
    </>
  ),
  support: (
    <>
      <path d="M12 20s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.7 12 20 12 20z" />
      <path d="M9.5 12.5h5M12 10v5" />
    </>
  ),
  business: (
    <>
      <path d="M4 9h16v10H4zM4 9l1.5-4h13L20 9" />
      <path d="M4 9c0 1.4 1.3 2.2 2.7 2.2S9.3 10.4 9.3 9c0 1.4 1.3 2.2 2.7 2.2s2.7-.8 2.7-2.2c0 1.4 1.3 2.2 2.6 2.2S20 10.4 20 9M10 19v-4h4v4" />
    </>
  ),
  vehicle: (
    <>
      <path d="M4 15.5V12l2-4.5h12L20 12v3.5" />
      <rect x="3" y="12" width="18" height="5" rx="1.5" />
      <circle cx="7.5" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </>
  ),
  law: (
    <>
      <path d="M12 4v16M7 20h10M5 7h14M12 4l-1 3M12 4l1 3" />
      <path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" />
    </>
  ),
  education: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.5v4.2c1.5 1.4 3.4 2.1 5.5 2.1s4-.7 5.5-2.1v-4.2M21.5 9.5v5" />
    </>
  ),
  health: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 18.5h3M10 5.5h4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5z" />
    </>
  ),
};

export function CategoryIcon({ name, className = 'size-7' }: { name: IconName } & P) {
  return (
    <svg viewBox="0 0 24 24" {...base} className={className}>
      {PATHS[name]}
    </svg>
  );
}

function make(children: React.ReactNode) {
  return function Icon({ className = 'size-5' }: P) {
    return (
      <svg viewBox="0 0 24 24" {...base} className={className}>
        {children}
      </svg>
    );
  };
}

export const SendIcon = make(<path d="M5 12h13M13 6l6 6-6 6" />);
export const MicIcon = make(
  <>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </>,
);
export const StopIcon = make(<rect x="7" y="7" width="10" height="10" rx="2" />);
export const ExternalIcon = make(<path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />);
export const ShieldIcon = make(
  <>
    <path d="M12 3 5 6v5.5c0 4.4 3 7.9 7 9.5 4-1.6 7-5.1 7-9.5V6z" />
    <path d="M9.5 12l1.8 1.8 3.4-3.6" />
  </>,
);
export const InfoIcon = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </>,
);
export const SunIcon = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </>,
);
export const MoonIcon = make(<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />);
export const ThumbUpIcon = make(<path d="M7 11v9H4v-9zM7 11l4-7a2 2 0 0 1 2.6 2.3L13 10h5.3a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17 20H7" />);
export const ThumbDownIcon = make(<path d="M17 13V4h3v9zM17 13l-4 7a2 2 0 0 1-2.6-2.3L11 14H5.7a2 2 0 0 1-2-2.4l1.3-6A2 2 0 0 1 7 4h10" />);
export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </>,
);
export const ArrowRightIcon = make(<path d="M5 12h14M13 6l6 6-6 6" />);
export const EyeOffIcon = make(
  <>
    <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.4 9.5 6-.5.8-1.6 2.3-3.2 3.6M6.2 7.6C4.5 8.9 3.2 10.6 2.5 12c1 1.6 4.5 6 9.5 6 1.5 0 2.9-.4 4.1-1" />
    <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
  </>,
);

export function LogoMark({ className = 'size-9' }: P) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M20 2.5 35.2 11.25v17.5L20 37.5 4.8 28.75v-17.5z" fill="var(--brand)" />
      <path
        d="M14.5 15.8a5.5 5.5 0 1 1 7.6 5.1c-1.3.5-2.1 1.4-2.1 2.7v.9"
        fill="none"
        stroke="var(--brand-ink)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="20" cy="29" r="1.7" fill="var(--brand-ink)" />
    </svg>
  );
}
