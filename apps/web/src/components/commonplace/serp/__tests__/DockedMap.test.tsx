// @vitest-environment jsdom
/**
 * The docked map (HANDOFF-SEARCH-CONSTELLATION D4): it marks visited nodes
 * accurately across three openings, and clicking it reopens the map full size
 * rather than restarting anything.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CONSTELLATION_FULL_FIXTURE } from '@commonplace/block-view-contracts/search-stack-fixture';
import { parseConstellationPayload } from '@/lib/constellation-payload';
import { DockedMap } from '../DockedMap';

afterEach(cleanup);

function payload() {
  const parsed = parseConstellationPayload(CONSTELLATION_FULL_FIXTURE);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.payload;
}

function visitedIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('circle[data-visited="true"]')].map(
    (node) => node.getAttribute('data-node-id') ?? '',
  );
}

describe('the docked map', () => {
  it('marks nothing before the first opening', () => {
    const { container } = render(
      <DockedMap payload={payload()} visited={[]} onReopen={() => undefined} />,
    );
    expect(visitedIds(container)).toEqual([]);
    expect(container.querySelectorAll('circle').length).toBe(payload().nodes.length);
  });

  it('shows visited state accurately across three openings', () => {
    const full = payload();
    const opened: string[] = [];
    const view = render(
      <DockedMap payload={full} visited={opened} onReopen={() => undefined} />,
    );

    for (let step = 0; step < 3; step += 1) {
      opened.push(full.nodes[step].id);
      view.rerender(
        <DockedMap payload={full} visited={[...opened]} onReopen={() => undefined} />,
      );
      // After each opening exactly the nodes opened so far are marked.
      expect(new Set(visitedIds(view.container))).toEqual(new Set(opened));
      expect(visitedIds(view.container)).toHaveLength(step + 1);
    }

    // And the unopened remainder is still unmarked.
    const unopened = full.nodes.slice(3).map((node) => node.id);
    for (const id of unopened) {
      expect(visitedIds(view.container)).not.toContain(id);
    }
  });

  it('states the visit count and reads every node state as text', () => {
    const full = payload();
    render(
      <DockedMap
        payload={full}
        visited={[full.nodes[0].id, full.nodes[1].id]}
        onReopen={() => undefined}
      />,
    );
    expect(screen.getByText(`2/${full.nodes.length} opened`)).toBeTruthy();
    const map = screen.getByTestId('docked-map');
    expect(map.getAttribute('aria-label')).toContain(`2 of ${full.nodes.length} results opened`);
    const rows = map.querySelectorAll('li[data-node-id]');
    expect(rows).toHaveLength(full.nodes.length);
    expect(rows[0].getAttribute('data-visited')).toBe('true');
    expect(rows[rows.length - 1].getAttribute('data-visited')).toBe('false');
  });

  it('reopens full size when clicked', () => {
    const onReopen = vi.fn();
    render(<DockedMap payload={payload()} visited={[]} onReopen={onReopen} />);
    fireEvent.click(screen.getByTestId('docked-map'));
    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  it('lays the thumbnail out from the same seed as the full size scene', () => {
    const full = payload();
    const first = render(<DockedMap payload={full} visited={[]} onReopen={() => undefined} />);
    const before = [...first.container.querySelectorAll('circle')].map((node) => node.getAttribute('cx'));
    cleanup();
    const second = render(<DockedMap payload={full} visited={[]} onReopen={() => undefined} />);
    const after = [...second.container.querySelectorAll('circle')].map((node) => node.getAttribute('cx'));
    expect(after).toEqual(before);
  });
});
