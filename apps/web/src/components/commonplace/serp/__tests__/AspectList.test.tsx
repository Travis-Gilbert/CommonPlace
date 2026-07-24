// @vitest-environment jsdom
/**
 * The F5 row contract: title, snippet with exact-hit emphasis, lane badge,
 * relation badge, source. Every one of the five is asserted, because a row that
 * drops one of them stops being a find/go projection and becomes a link list.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { FindResponse } from '@commonplace/block-view-contracts/search-stack';
import { AspectList } from '../AspectList';
import { fixtureAspectFind, fixtureOrphanFind } from '@/lib/search-stack/fixtures';

afterEach(cleanup);

const RESPONSE: FindResponse = fixtureAspectFind('budget', 0.5);

describe('the ranked row', () => {
  it('carries the title', () => {
    render(<AspectList response={RESPONSE} />);
    expect(screen.getByText('The membrane admits by budget')).toBeTruthy();
  });

  it('emphasizes the exact hit inside the snippet', () => {
    const { container } = render(<AspectList response={RESPONSE} />);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(0);
    // The emphasis is the matched text, not the whole snippet.
    expect(marks[0].textContent?.toLowerCase()).toBe('budget');
    const row = marks[0].closest('button');
    expect(row?.textContent).toContain('A budget is a promise about attention');
  });

  it('renders the snippet plain when there is no literal match to point at', () => {
    const semanticOnly: FindResponse = {
      ...RESPONSE,
      // The response answered a query whose terms are nowhere in the snippet,
      // which is what a meaning-matched hit looks like.
      query: 'zzzzz',
      results: [
        {
          ...RESPONSE.results[0],
          hit: {
            ...RESPONSE.results[0].hit,
            lane: 'SEMANTIC',
            snippet: 'a passage about attention with no shared characters',
          },
        },
      ],
    };
    const { container } = render(
      <AspectList response={semanticOnly} />,
    );
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(screen.getByText('a passage about attention with no shared characters')).toBeTruthy();
  });

  it('carries the lane badge', () => {
    render(<AspectList response={RESPONSE} />);
    const rows = screen.getAllByRole('button');
    // The exact-lane hit is badged Exact; the semantic one is badged Semantic.
    expect(within(rows[0]).getByText('Exact')).toBeTruthy();
    expect(screen.getAllByText('Semantic').length).toBeGreaterThan(0);
  });

  it('carries the relation badge, as a mark plus a word', () => {
    render(<AspectList response={RESPONSE} />);
    const rows = screen.getAllByRole('button');
    expect(within(rows[0]).getByText('Known')).toBeTruthy();
    // The contradicting corpus result is badged and marked as such.
    const contradicting = rows.find((row) => row.dataset.relation === 'CONTRADICTS');
    expect(contradicting).toBeTruthy();
    expect(within(contradicting as HTMLElement).getByText('Contradicts')).toBeTruthy();
  });

  it('carries the source', () => {
    render(<AspectList response={RESPONSE} />);
    expect(screen.getAllByText('commonplace.local').length).toBeGreaterThan(0);
    expect(screen.getByText('example.com')).toBeTruthy();
  });

  it('opens the result it was clicked on', () => {
    const onOpen = vi.fn();
    render(<AspectList response={RESPONSE} onOpen={onOpen} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0].hit.doc).toBe(RESPONSE.results[0].hit.doc);
  });

  it('renders every row of an all-orphan response without throwing', () => {
    const orphan = fixtureOrphanFind('membrane');
    render(<AspectList response={orphan} />);
    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(orphan.results.length);
    expect(rows.every((row) => row.dataset.relation === 'ORPHAN')).toBe(true);
  });

  it('renders an honest empty state rather than an empty list', () => {
    render(<AspectList response={{ ...RESPONSE, results: [] }} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText(/admitted nothing for this aspect/i)).toBeTruthy();
  });
});
