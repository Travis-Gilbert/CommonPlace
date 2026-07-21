// SOURCING: none. Pure boot brief cap tests.

import { describe, expect, it } from 'vitest';
import {
  capBootBrief,
  estimateBootTokens,
  loadSessionBootBrief,
} from './session-boot';

describe('ACP session boot brief', () => {
  it('caps markdown by the configured token estimate', () => {
    const capped = capBootBrief('a'.repeat(80), 10);
    expect(estimateBootTokens(capped)).toBeLessThanOrEqual(10);
    expect(capped).toContain('Boot brief truncated to 10 token cap.');
  });

  it('renders a brief from an injected provider', async () => {
    await expect(loadSessionBootBrief({
      tokenCap: 2000,
      provider: async () => ({
        markdown: '## Boot\nUse live context.',
        degradation: { degraded: false, missing: [] },
        generation: 4,
      }),
    })).resolves.toBe('## Boot\nUse live context.');
  });
});
