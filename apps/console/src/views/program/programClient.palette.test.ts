import { describe, expect, it } from 'vitest';
import { filterPaletteCommands, type PaletteCommand } from './programClient';

describe('slash palette filter', () => {
  const rows: readonly PaletteCommand[] = [
    {
      slug: 'status',
      title: 'Status',
      summary: 'No selection',
      requiresSelection: false,
      params: [],
    },
    {
      slug: 'rewrite',
      title: 'Rewrite',
      summary: 'Needs selection',
      requiresSelection: true,
      params: [],
    },
  ];

  it('hides requires_selection commands without a selection', () => {
    const visible = filterPaletteCommands(rows, false);
    expect(visible.map((row) => row.slug)).toEqual(['status']);
  });

  it('includes requires_selection commands when a selection is present', () => {
    const visible = filterPaletteCommands(rows, true);
    expect(visible.map((row) => row.slug)).toEqual(['status', 'rewrite']);
  });
});
