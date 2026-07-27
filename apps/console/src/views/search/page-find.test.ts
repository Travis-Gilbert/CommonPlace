// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findTargetOffset, highlightPageTarget } from './page-find';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  document.body.replaceChildren();
});

describe('page Find host', () => {
  it('uses prefix and suffix to disambiguate repeated quotes', () => {
    expect(findTargetOffset(
      'first budget draft, final budget promise',
      {
        quote: 'budget',
        prefix: 'final ',
        suffix: ' promise',
      },
    )).toEqual({ start: 26, end: 32 });
  });

  it('highlights a target split across nested DOM text nodes', () => {
    const root = document.createElement('main');
    root.innerHTML = '<p>A <strong>budget</strong> is a promise.</p>';
    document.body.append(root);

    expect(highlightPageTarget(root, {
      quote: 'budget',
      prefix: 'A ',
      suffix: ' is a promise',
    })).toBe(true);
    expect(window.getSelection()?.toString()).toBe('budget');
    expect(root.dataset.searchPageHit).toBe('budget');
  });
});
