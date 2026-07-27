// SOURCING: none. Regression coverage for repeated callback query parameters.

import { describe, expect, it } from 'vitest';
import LoginRoute from './page';

describe('login route', () => {
  it('falls back when callbackUrl is repeated', async () => {
    const page = await LoginRoute({
      searchParams: Promise.resolve({
        callbackUrl: ['/workspace/research/chat', '//attacker.example/path'],
      }),
    });

    expect(page.props.callbackUrl).toBe('/chat');
  });
});
