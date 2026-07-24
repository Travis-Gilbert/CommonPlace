// @vitest-environment jsdom
/**
 * The SERP acceptance criteria, measured through the mounted surface rather
 * than through the store: composer submit renders the B5 scene, a node click
 * opens layer two, the scene and the list come from ONE backend request, the
 * expand gesture re-scatters, the constellation survives a click-through, and a
 * query with no graph connection draws Orphan nodes instead of failing.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const searchClient = vi.hoisted(() => ({
  runScatter: vi.fn(),
  runFind: vi.fn(),
  runExpand: vi.fn(),
  saveUrl: vi.fn(),
  scopeToInput: vi.fn(),
}));
vi.mock('@/lib/search-stack/client', () => searchClient);

import ScatterSerp from '../ScatterSerp';
import { useSearchStack } from '@/lib/search-stack/store';
import {
  fixtureAspectFind,
  fixtureExpand,
  fixtureOrphanFind,
  fixtureScatter,
} from '@/lib/search-stack/fixtures';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  // Base UI's slider measures its control; jsdom has no layout engine.
  if (!('ResizeObserver' in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

beforeEach(() => {
  searchClient.runScatter.mockReset();
  searchClient.runFind.mockReset();
  searchClient.runExpand.mockReset();
  searchClient.runScatter.mockImplementation(async (request: { query: string; lambda: number }) =>
    fixtureScatter(request.query, request.lambda),
  );
  searchClient.runFind.mockImplementation(async (request: { query: string; lambda: number }) =>
    fixtureAspectFind(request.query, request.lambda),
  );
  searchClient.runExpand.mockImplementation(async (request: { aspectId: string; lambda: number }) =>
    fixtureExpand('membrane', request.aspectId, request.lambda),
  );
  useSearchStack.getState().reset();
});

afterEach(() => {
  cleanup();
  useSearchStack.getState().reset();
});

const openPage = vi.fn(async () => undefined);

function mount() {
  return render(<ScatterSerp sessionId={null} onOpenPage={openPage} />);
}

async function submit(question: string) {
  const input = screen.getByLabelText('Ask Theseus a question');
  fireEvent.change(input, { target: { value: question } });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });
}

/** The result node marks in the scene, in document order. */
function sceneNodes(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('.cp-constellation-node[data-kind="result"]')] as HTMLElement[];
}

describe('composer submit', () => {
  it('renders the B5 scene as the results surface', async () => {
    const { container } = mount();
    await submit('membrane');
    await waitFor(() => expect(sceneNodes(container).length).toBe(3));
    expect(searchClient.runScatter).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Budget discipline').length).toBeGreaterThan(0);
  });
});

describe('aspect selection', () => {
  it('issues exactly one backend request and renders both scene and list from it', async () => {
    const { container } = mount();
    await submit('membrane');
    await waitFor(() => expect(sceneNodes(container).length).toBe(3));

    await act(async () => {
      fireEvent.click(sceneNodes(container)[0]);
    });
    await waitFor(() => expect(searchClient.runFind).toHaveBeenCalledTimes(1));

    // The scene is now layer two, drawn from that response.
    await waitFor(() => expect(sceneNodes(container).length).toBe(3));
    expect(screen.getByLabelText('Search results').dataset.layer).toBe('aspect');

    // Toggling to the plain list renders the SAME response, with no second call.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show plain list' }));
    });
    expect(screen.getByText('The membrane admits by budget')).toBeTruthy();
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);
    expect(searchClient.runFind).toHaveBeenCalledTimes(1);

    // And back to the scene, still one call.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show constellation' }));
    });
    expect(searchClient.runFind).toHaveBeenCalledTimes(1);
  });
});

describe('click through and back', () => {
  it('preserves the constellation across node, list and page', async () => {
    const { container } = mount();
    await submit('membrane');
    await waitFor(() => expect(sceneNodes(container).length).toBe(3));

    // node -> layer two
    await act(async () => {
      fireEvent.click(sceneNodes(container)[0]);
    });
    await waitFor(() => expect(searchClient.runFind).toHaveBeenCalledTimes(1));

    // -> list
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show plain list' }));
    });
    // -> page
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /The membrane admits by budget/ })[0]);
    });
    await waitFor(() => expect(openPage).toHaveBeenCalled());
    expect(useSearchStack.getState().docked).toBe(true);

    // -> back to the aspects, and the graph is still the same graph
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show constellation' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Aspects' }));
    });
    await waitFor(() => expect(screen.getAllByText('Budget discipline').length).toBeGreaterThan(0));
    expect(searchClient.runScatter).toHaveBeenCalledTimes(1);
    expect(searchClient.runFind).toHaveBeenCalledTimes(1);
  });
});

describe('the expand gesture', () => {
  it('re-scatters the node it was made on and leaves the rest alone', async () => {
    const { container } = mount();
    await submit('membrane');
    await waitFor(() => expect(sceneNodes(container).length).toBe(3));
    expect(screen.getAllByText('Open frontier').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.doubleClick(sceneNodes(container)[0]);
    });
    await waitFor(() => expect(searchClient.runExpand).toHaveBeenCalledTimes(1));
    expect(searchClient.runExpand).toHaveBeenCalledWith(
      expect.objectContaining({ aspectId: 'aspect-budget' }),
    );

    await waitFor(() => expect(screen.queryAllByText('Budget discipline')).toHaveLength(0));
    // The untouched neighbours are still on the surface.
    expect(screen.getAllByText('Open frontier').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Attention as a promise').length).toBeGreaterThan(0);
    // And the sub-aspects took the expanded node's place.
    expect(screen.getAllByText('Deferral, not refusal').length).toBeGreaterThan(0);
  });

  it('advertises the gesture in the accessible name only where it is wired', async () => {
    const { container } = mount();
    await submit('membrane');
    await waitFor(() => expect(sceneNodes(container).length).toBe(3));
    expect(sceneNodes(container)[0].getAttribute('aria-label')).toContain('press E to expand');

    // Layer two has nothing to expand into, so it does not claim to.
    await act(async () => {
      fireEvent.click(sceneNodes(container)[0]);
    });
    await waitFor(() => expect(searchClient.runFind).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(sceneNodes(container)[0].getAttribute('aria-label')).not.toContain('to expand'),
    );
  });
});

describe('zero graph connection', () => {
  it('renders every node Orphan-styled rather than failing', async () => {
    searchClient.runFind.mockImplementation(async (request: { query: string }) =>
      fixtureOrphanFind(request.query),
    );
    const { container } = mount();
    await submit('membrane');
    await waitFor(() => expect(sceneNodes(container).length).toBe(3));

    await act(async () => {
      fireEvent.click(sceneNodes(container)[0]);
    });
    await waitFor(() => expect(searchClient.runFind).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      const nodes = sceneNodes(container);
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.every((node) => node.dataset.relation === 'ORPHAN')).toBe(true);
    });
    // No edge was drawn, and the surface says so instead of erroring.
    expect(container.querySelectorAll('.cp-constellation-edge')).toHaveLength(0);
    expect(screen.getByText(/No connection survived the evidence test/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the lambda dial', () => {
  it('shows the current value and sends it with the next submit', async () => {
    mount();
    expect(screen.getByTestId('lambda-readout').textContent).toBe('0.50');

    act(() => {
      useSearchStack.getState().setLambda(0.2);
    });
    await waitFor(() => expect(screen.getByTestId('lambda-readout').textContent).toBe('0.20'));

    await submit('membrane');
    expect(searchClient.runScatter).toHaveBeenLastCalledWith(
      expect.objectContaining({ lambda: 0.2 }),
    );
  });
});
