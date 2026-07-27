import { describe, expect, it } from 'vitest';
import { isTextualFile, PASTE_CARD_THRESHOLD } from './file-text';

describe('file-text', () => {
  it('recognizes textual extensions', () => {
    expect(isTextualFile(new File(['x'], 'note.md', { type: '' }))).toBe(true);
    expect(isTextualFile(new File(['x'], 'photo.png', { type: 'image/png' }))).toBe(false);
  });

  it('keeps the paste card threshold above ordinary lines', () => {
    expect(PASTE_CARD_THRESHOLD).toBeGreaterThan(100);
  });
});
