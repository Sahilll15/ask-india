import type { Metadata } from 'next';

export const SITE_URL = 'https://askindia.online';
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const PERSON_ID = 'https://sahilchalke.com/#person';
const ogImageAlt = 'Ask India answering how to link PAN with Aadhaar with numbered steps and links to official pages';

/** Page metadata with matching canonical, Open Graph and Twitter fields. */
export function pageMetadata({ title, description, path, absoluteTitle = false }: { title: string; description: string; path: string; absoluteTitle?: boolean }): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · Ask India`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: 'Ask India',
      title: fullTitle,
      description,
      url: path,
      locale: 'en_IN',
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: ogImageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@chalke1015',
      title: fullTitle,
      description,
      images: [{ url: '/twitter-image.png', alt: ogImageAlt }],
    },
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE_URL}${it.path}` })),
  };
}

export const hasDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);
