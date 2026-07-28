// SOURCING: none — pure gallery fixture filter for CommandsGalleryView.

import { describe, expect, it } from 'vitest';

import type { GalleryEntry } from './CommandsGalleryView';

const FIXTURE: readonly GalleryEntry[] = [
  {
    kind: 'monitor_template',
    slugOrName: 'Price watch',
    title: 'Price watch',
    summary: 'Watch a product page price',
    programId: 'program:price-watch',
    validationPassed: true,
    validationChecks: ['program_identity'],
  },
  {
    kind: 'command',
    slugOrName: 'price',
    title: 'Price',
    summary: 'Published price command',
    publicationRef: 'pub:1',
    validationPassed: true,
  },
];

describe('commands gallery fixtures', () => {
  it('exposes forkable templates with validation receipts', () => {
    const templates = FIXTURE.filter((entry) => entry.kind === 'monitor_template');
    expect(templates).toHaveLength(1);
    expect(templates[0]?.validationPassed).toBe(true);
    expect(templates[0]?.programId).toBeTruthy();
  });

  it('lists published commands alongside templates', () => {
    expect(FIXTURE.some((entry) => entry.kind === 'command' && entry.publicationRef)).toBe(true);
  });
});
