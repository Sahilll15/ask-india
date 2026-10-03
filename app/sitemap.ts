import type { MetadataRoute } from 'next';

const base = 'https://askindia.online';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/directory`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about`, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
