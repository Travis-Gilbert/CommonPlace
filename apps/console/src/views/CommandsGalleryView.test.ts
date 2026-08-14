// SOURCING: none — gallery fork eligibility for CommandsGalleryView.

import { describe, expect, it } from 'vitest';

import { canForkGalleryEntry } from './program/programClient';
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
    source: 'substrate',
  },
  {
    kind: 'command',
    slugOrName: 'price',
    title: 'Price',
    summary: 'Published price command',
    programId: 'cid:price',
    publicationRef: 'pub:1',
    validationPassed: true,
    source: 'substrate',
  },
  {
    kind: 'monitor_template',
    slugOrName: 'Price watch',
    title: 'Price watch',
    summary: 'LocalDevCommandGallery stand-in',
    programId: 'program:price-watch',
    source: 'LocalDevCommandGallery',
  },
];

describe('commands gallery fixtures', () => {
  it('exposes forkable templates with validation receipts', () => {
    const templates = FIXTURE.filter((entry) => entry.kind === 'monitor_template');
    expect(templates).toHaveLength(2);
    expect(templates[0]?.validationPassed).toBe(true);
    expect(templates[0]?.programId).toBeTruthy();
  });

  it('lists published commands alongside templates', () => {
    expect(FIXTURE.some((entry) => entry.kind === 'command' && entry.publicationRef)).toBe(true);
  });

  it('forks substrate templates and commands, not LocalDev stand-ins', () => {
    expect(canForkGalleryEntry(FIXTURE[0]!)).toBe(true);
    expect(canForkGalleryEntry(FIXTURE[1]!)).toBe(true);
    expect(canForkGalleryEntry(FIXTURE[2]!)).toBe(false);
  });
});
