// SOURCING: none. The former Models path permanently redirects to Data model.

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: mocks.permanentRedirect,
}));

import LegacyModelsPage from './page';

describe('legacy Models route', () => {
  it('permanently redirects to the canonical Data model route', () => {
    expect(() => LegacyModelsPage()).toThrow('NEXT_REDIRECT:/Data-model');
    expect(mocks.permanentRedirect).toHaveBeenCalledWith('/Data-model');
  });
});
