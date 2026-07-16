// SOURCING: none — thin HTML bridge until Galley owns server HTML paths (HANDOFF-CANON C3)
/**
 * Server-side markdown → HTML without remark-html.
 * Prefer Galley/React at the surface; this exists for content.ts / ReadingPane.
 */
export async function markdownToHtml(md: string): Promise<string> {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const withInline = escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>');
  return withInline
    .split(/\n\n+/)
    .map((block) => {
      if (/^<h[1-3]>/.test(block)) return block;
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}
