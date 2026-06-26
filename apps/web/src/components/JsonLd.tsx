// Structured data for rich Google results (knowledge panel, articles)
// Add PersonJsonLd and WebSiteJsonLd to root layout.
// Add ArticleJsonLd to individual essay and field note pages.

export function PersonJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Travis Gilbert',
    url: 'https://travisgilbert.me',
    description:
      'Exploring how design decisions shape human outcomes. Essays, field notes, and projects on design, policy, and the built environment.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Flint',
      addressRegion: 'MI',
      addressCountry: 'US',
    },
    sameAs: [
      'https://patreon.com/TravisGilbert',
      'https://www.youtube.com/@TravisGilbert',
      'https://www.instagram.com/travisogilbert/',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Travis Gilbert',
    url: 'https://travisgilbert.me',
    description:
      'Exploring how design decisions shape human outcomes.',
    author: {
      '@type': 'Person',
      name: 'Travis Gilbert',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function ArticleJsonLd({
  title,
  description,
  slug,
  datePublished,
  section,
  tags,
}: {
  title: string;
  description: string;
  slug: string;
  datePublished: Date;
  section: 'essays' | 'field-notes';
  tags?: string[];
}) {
  const url = `https://travisgilbert.me/${section}/${slug}`;
  const iso = datePublished.toISOString();

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    datePublished: iso,
    dateModified: iso,
    author: {
      '@type': 'Person',
      name: 'Travis Gilbert',
      url: 'https://travisgilbert.me',
    },
    publisher: {
      '@type': 'Person',
      name: 'Travis Gilbert',
    },
    ...(tags && tags.length > 0 ? { keywords: tags.join(', ') } : {}),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
