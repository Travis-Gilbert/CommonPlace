/**
 * Convert a tag string to a URL-safe slug.
 * "urban design" → "urban-design"
 * "AI & Automation" → "ai-automation"
 */
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
