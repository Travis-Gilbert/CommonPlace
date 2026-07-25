// SOURCING: none. Component contract renders through React server output.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RemedyCard } from './RemedyCard';

describe('RemedyCard', () => {
  it('renders explanation, missing value, and copyable next_call JSON', () => {
    const markup = renderToStaticMarkup(
      <RemedyCard
        remedy={{
          explanation: 'Grant the missing consent.',
          missing: { kind: 'capability', value: 'github.write' },
          nextCall: { surface: 'plan', arguments: { action: 'consent' } },
        }}
      />,
    );
    expect(markup).toContain('Grant the missing consent.');
    expect(markup).toContain('github.write');
    expect(markup).toContain('Copy next_call');
    expect(markup).toContain('&quot;surface&quot;');
  });
});
