// SOURCING: none. Pure helpers for textual attachment preview (CH5).

const TEXTUAL_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'css', 'scss', 'html', 'htm', 'xml', 'yaml', 'yml', 'toml', 'py', 'rs',
  'go', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'sh', 'bash', 'zsh',
  'sql', 'graphql', 'env', 'gitignore', 'dockerfile',
]);

export function isTextualFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true;
  if (file.type === 'application/json' || file.type === 'application/xml') return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TEXTUAL_EXTENSIONS.has(ext);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  });
}

/** Pastes above this character count become a card, not textarea text (CH5). */
export const PASTE_CARD_THRESHOLD = 400;

let fallbackSeq = 0;

export function newAttachmentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackSeq += 1;
  return `att-${Date.now()}-${fallbackSeq}`;
}
