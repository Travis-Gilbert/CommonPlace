import type { MetadataRoute } from 'next';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, Project, ShelfEntry } from '@/lib/content';
import { gqlPublicAliases } from '@/lib/commonplace-graphql';
import { slugifyTag } from '@/lib/slugify';

// Regenerate hourly so newly-published public blocks enter the sitemap
// (HANDOFF-PUBLISH P3.2). Unlisted and private blocks never appear: the API
// enumerates public aliases only, and those pages also carry noindex.
export const revalidate = 3600;

const BASE_URL = 'https://travisgilbert.me';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public published blocks (best effort: an unreachable API omits them rather
  // than failing the sitemap).
  const publicAliases = await gqlPublicAliases().catch(() => [] as string[]);
  const publishedEntries: MetadataRoute.Sitemap = publicAliases.map((alias) => ({
    url: `${BASE_URL}/p/${alias}`,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));
  const essays = getCollection<Essay>('essays').filter(
    (i) => !i.data.draft
  );
  const fieldNotes = getCollection<FieldNote>('field-notes').filter(
    (n) => !n.data.draft
  );
  const projects = getCollection<Project>('projects').filter(
    (p) => !p.data.draft
  );
  const shelfItems = getCollection<ShelfEntry>('shelf');

  // Collect all unique tag slugs
  const tagSlugs = new Set<string>();
  for (const item of [
    ...essays,
    ...fieldNotes,
    ...projects,
    ...shelfItems,
  ]) {
    for (const tag of item.data.tags) {
      tagSlugs.add(slugifyTag(tag));
    }
  }

  return [
    // Static pages
    { url: BASE_URL, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${BASE_URL}/essays`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${BASE_URL}/field-notes`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${BASE_URL}/projects`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE_URL}/shelf`, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE_URL}/toolkit`, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE_URL}/tags`, changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${BASE_URL}/colophon`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${BASE_URL}/connect`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${BASE_URL}/now`, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${BASE_URL}/changelog`, changeFrequency: 'daily' as const, priority: 0.5 },
    { url: `${BASE_URL}/stats`, changeFrequency: 'weekly' as const, priority: 0.5 },

    // Dynamic essay pages
    ...essays.map((i) => ({
      url: `${BASE_URL}/essays/${i.slug}`,
      lastModified: i.data.date,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),

    // Dynamic field note pages
    ...fieldNotes.map((n) => ({
      url: `${BASE_URL}/field-notes/${n.slug}`,
      lastModified: n.data.date,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),

    // Tag pages
    ...Array.from(tagSlugs).map((slug) => ({
      url: `${BASE_URL}/tags/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),

    // Public published blocks (HANDOFF-PUBLISH P3.2).
    ...publishedEntries,
  ];
}
