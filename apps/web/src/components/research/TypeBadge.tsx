/**
 * TypeBadge: Source type indicator (Book, Paper, Document, etc.)
 *
 * Teal background with cream text. Space Mono 10px uppercase.
 * Part of the Research Trail's Editor typography system.
 */

const TYPE_LABELS: Record<string, string> = {
  book: 'Book',
  article: 'Article',
  paper: 'Paper',
  video: 'Video',
  podcast: 'Podcast',
  dataset: 'Dataset',
  document: 'Document',
  report: 'Report',
  map: 'Map',
  archive: 'Archive',
  interview: 'Interview',
  website: 'Website',
};

interface TypeBadgeProps {
  type: string;
}

export default function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <span className="inline-block font-mono-alt text-[10px] font-normal uppercase tracking-[0.08em] text-surface bg-teal px-2 py-[2px] rounded-[3px] whitespace-nowrap">
      {TYPE_LABELS[type] || type}
    </span>
  );
}
