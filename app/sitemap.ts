import type { MetadataRoute } from 'next';
import { GUIDES, LAST_CHECKED_ISO } from './guides/data.ts';

const base = 'https://askindia.online';

// Bump a date only when that page's content changes.
const UPDATED = { home: '2026-10-04', directory: '2026-10-04', about: '2026-10-04', guides: LAST_CHECKED_ISO };

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/`, lastModified: UPDATED.home, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/guides`, lastModified: UPDATED.guides, changeFrequency: 'monthly', priority: 0.9 },
    ...GUIDES.map((g) => ({ url: `${base}/guides/${g.slug}`, lastModified: UPDATED.guides, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${base}/directory`, lastModified: UPDATED.directory, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about`, lastModified: UPDATED.about, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
