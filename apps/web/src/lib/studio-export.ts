/**
 * Studio export helpers.
 * Supports markdown, plain text, and PDF downloads from editor content.
 */

export type StudioExportFormat = 'markdown' | 'txt' | 'pdf';

function sanitizeFileNamePart(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function fileBaseName(title: string, slug: string): string {
  const fromTitle = sanitizeFileNamePart(title);
  const fromSlug = sanitizeFileNamePart(slug);
  return fromTitle || fromSlug || 'studio-export';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '- ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function exportMarkdown(markdown: string, title: string, slug: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${fileBaseName(title, slug)}.md`);
}

function exportText(markdown: string, title: string, slug: string): void {
  const text = plainTextFromMarkdown(markdown);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${fileBaseName(title, slug)}.txt`);
}

async function exportPdf(_markdown: string, _title: string, _slug: string): Promise<void> {
  throw new Error('PDF generation is the Typst path (HANDOFF-CANON / D9); jspdf is cut.');
}

export async function exportStudioDocument(params: {
  format: StudioExportFormat;
  markdown: string;
  title: string;
  slug: string;
}): Promise<void> {
  const { format, markdown, title, slug } = params;

  if (format === 'markdown') {
    exportMarkdown(markdown, title, slug);
    return;
  }

  if (format === 'txt') {
    exportText(markdown, title, slug);
    return;
  }

  await exportPdf(markdown, title, slug);
}
