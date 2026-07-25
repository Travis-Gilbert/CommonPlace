// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  MAX_CONSTELLATION_MEMORY_NODES,
  MAX_CONSTELLATION_RESULT_NODES,
} from '@commonplace/block-view-contracts/search-stack';
import {
  CONSTELLATION_FULL_FIXTURE,
  CONSTELLATION_NO_MEMORY_FIXTURE,
  CONSTELLATION_OVERSIZED_FIXTURE,
  CONSTELLATION_SCENE_PACKAGE_FIXTURE,
  CONSTELLATION_STATE_FIXTURES,
  CONSTELLATION_ZERO_EDGE_FIXTURE,
} from '@commonplace/block-view-contracts/search-stack-fixture';
import { parseConstellationPayload } from '@/lib/constellation-payload';
import ConstellationRenderer, {
  ConstellationSurface,
  edgeAnnotation,
  memoryAnnotation,
  nodeAnnotation,
} from '../renderers/ConstellationRenderer';
import { SCENE_RENDERER_REGISTRY } from '../registry';

const SPINNER_SELECTOR = '[role="progressbar"], [class*="spin"], [class*="Spin"], [aria-busy="true"]';

function capped(payload: typeof CONSTELLATION_OVERSIZED_FIXTURE) {
  const parsed = parseConstellationPayload(payload);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.payload;
}

beforeAll(() => {
  // Default register: motion allowed. The reduced motion contract has its own file
  // because motion reads the media query once per module instance.
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
});

beforeEach(() => cleanup());

describe('descriptor registry', () => {
  it('resolves the renderer through SCENE_RENDERER_REGISTRY under force_graph', () => {
    const entry = SCENE_RENDERER_REGISTRY.force_graph;
    expect(entry).toBeDefined();
    expect(entry.id).toBe('force_graph');
    expect(entry.capability.rendererFamily).toBe('scene');
    expect(entry.capability.coordinateSpaces).toContain('graph');
    expect(entry.component).toBeDefined();
  });

  it('reads its payload from the scene package rather than a bespoke route prop', () => {
    render(<ConstellationRenderer scenePackage={CONSTELLATION_SCENE_PACKAGE_FIXTURE} />);
    expect(screen.getByLabelText(/Search constellation, success/)).toBeTruthy();
  });
});

describe('nodes and caps', () => {
  it('renders eight result nodes and two memory nodes and no more', () => {
    const { container } = render(
      <ConstellationSurface state={{ kind: 'success', payload: capped(CONSTELLATION_OVERSIZED_FIXTURE) }} />,
    );
    expect(container.querySelectorAll('[data-kind="result"]')).toHaveLength(
      MAX_CONSTELLATION_RESULT_NODES,
    );
    expect(container.querySelectorAll('[data-kind="memory"]')).toHaveLength(
      MAX_CONSTELLATION_MEMORY_NODES,
    );
  });

  it('gives every result node its annotation as its accessible name', () => {
    render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    for (const node of CONSTELLATION_FULL_FIXTURE.nodes) {
      expect(screen.getByRole('button', { name: nodeAnnotation(node) })).toBeTruthy();
    }
  });

  it('renders a real annotation list, one entry per node', () => {
    render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const list = screen.getByRole('list', { name: 'Nodes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(
      CONSTELLATION_FULL_FIXTURE.nodes.length + CONSTELLATION_FULL_FIXTURE.memoryNodes.length,
    );
  });
});

describe('edges carry their reason and evidence', () => {
  it('announces every edge with a non-empty reason and its evidence refs', () => {
    render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    for (const edge of CONSTELLATION_FULL_FIXTURE.edges) {
      expect(edge.reason.text.length).toBeGreaterThan(0);
      expect(edge.reason.evidenceRefs.length).toBeGreaterThan(0);
      const mark = screen.getByRole('group', { name: edgeAnnotation(edge) });
      expect(mark.getAttribute('aria-label')).toContain(edge.reason.text);
      for (const ref of edge.reason.evidenceRefs) {
        expect(mark.getAttribute('aria-label')).toContain(ref);
      }
    }
  });

  it('lists every edge reason in the annotation column', () => {
    render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const list = screen.getByRole('list', { name: 'Connections' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(CONSTELLATION_FULL_FIXTURE.edges.length);
    for (const edge of CONSTELLATION_FULL_FIXTURE.edges) {
      expect(within(list).getByText(edge.reason.text)).toBeTruthy();
    }
  });

  it('says so honestly when no edge survived the evidence test', () => {
    render(<ConstellationSurface state={{ kind: 'success', payload: CONSTELLATION_ZERO_EDGE_FIXTURE }} />);
    const list = screen.getByRole('list', { name: 'Connections' });
    expect(within(list).getByText(/No connection survived the evidence test/)).toBeTruthy();
    expect(screen.queryAllByRole('group', { name: /Evidence:/ })).toHaveLength(0);
  });
});

describe('gold memory nodes', () => {
  it('renders at most two, shaped differently from result nodes', () => {
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const memoryShapes = container.querySelectorAll('path.cp-constellation-memory-shape');
    const resultShapes = container.querySelectorAll('rect.cp-constellation-node-shape');
    expect(memoryShapes.length).toBe(2);
    expect(memoryShapes.length).toBeLessThanOrEqual(MAX_CONSTELLATION_MEMORY_NODES);
    expect(resultShapes.length).toBe(8);
  });

  it('opens the memory atom on click and never navigates to a url', () => {
    const opened: string[] = [];
    const before = window.location.href;
    const { container } = render(
      <ConstellationSurface
        state={CONSTELLATION_STATE_FIXTURES.success}
        onOpenMemoryAtom={(atomRef) => opened.push(atomRef)}
      />,
    );

    const memoryNodes = container.querySelectorAll('[data-kind="memory"]');
    memoryNodes.forEach((node) => fireEvent.click(node));

    expect(opened).toEqual(['atom:note/2026-06-perovskite-damp-heat', 'atom:claim/tandem-ageing-protocol']);
    expect(container.querySelectorAll('[data-kind="memory"] a')).toHaveLength(0);
    expect(container.querySelectorAll('[data-kind="memory"] [href]')).toHaveLength(0);
    expect(window.location.href).toBe(before);
  });

  it('carries the exact tier explanation on its edge into the results', () => {
    render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const memoryEdges = CONSTELLATION_FULL_FIXTURE.edges.filter(
      (edge) => edge.reason.type === 'memory_exact_tier',
    );
    expect(memoryEdges.length).toBeGreaterThan(0);
    for (const edge of memoryEdges) {
      expect(screen.getByRole('group', { name: edgeAnnotation(edge) })).toBeTruthy();
    }
  });

  it('announces the memory node with its worded connection', () => {
    render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    for (const node of CONSTELLATION_FULL_FIXTURE.memoryNodes) {
      const mark = screen.getByRole('button', { name: memoryAnnotation(node) });
      expect(mark.getAttribute('aria-label')).toContain(node.connectionExplanation);
    }
  });

  it('renders no gold node and no placeholder when the tenant graph does not intersect', () => {
    const { container } = render(
      <ConstellationSurface state={{ kind: 'success', payload: CONSTELLATION_NO_MEMORY_FIXTURE }} />,
    );
    expect(container.querySelectorAll('[data-kind="memory"]')).toHaveLength(0);
    expect(container.querySelectorAll('path.cp-constellation-memory-shape')).toHaveLength(0);
    expect(container.querySelectorAll('.cp-constellation-annotation-memory')).toHaveLength(0);
    expect(screen.queryByText(/no memory/i)).toBeNull();
    expect(container.querySelectorAll('[data-kind="result"]')).toHaveLength(8);
  });
});

describe('keyboard and callouts', () => {
  it('makes every node and every edge focusable', () => {
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const focusable = container.querySelectorAll('.cp-constellation-canvas [tabindex="0"]');
    expect(focusable.length).toBe(
      CONSTELLATION_FULL_FIXTURE.nodes.length +
        CONSTELLATION_FULL_FIXTURE.memoryNodes.length +
        CONSTELLATION_FULL_FIXTURE.edges.length,
    );
    for (const element of Array.from(focusable)) {
      expect(element.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('traverses between nodes without a pointer and opens one from the keyboard', () => {
    const opened: string[] = [];
    render(
      <ConstellationSurface
        state={CONSTELLATION_STATE_FIXTURES.success}
        onOpenResult={(url) => opened.push(url)}
      />,
    );
    const first = screen.getByRole('button', { name: nodeAnnotation(CONSTELLATION_FULL_FIXTURE.nodes[0]) });
    const second = screen.getByRole('button', { name: nodeAnnotation(CONSTELLATION_FULL_FIXTURE.nodes[1]) });

    (first as unknown as HTMLElement).focus();
    expect(document.activeElement).toBe(first);
    (second as unknown as HTMLElement).focus();
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: 'Enter' });
    expect(opened).toEqual([CONSTELLATION_FULL_FIXTURE.nodes[1].url]);
  });

  it('connects the annotation callout on focus and on hover', () => {
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const node = CONSTELLATION_FULL_FIXTURE.nodes[0];
    const mark = screen.getByRole('button', { name: nodeAnnotation(node) });

    expect(container.querySelector('.cp-constellation-callout')).toBeNull();

    fireEvent.focus(mark);
    expect(container.querySelector('.cp-constellation-callout')).not.toBeNull();
    expect(container.querySelector('.cp-constellation-callout line')).not.toBeNull();
    fireEvent.blur(mark);
    expect(container.querySelector('.cp-constellation-callout')).toBeNull();

    fireEvent.mouseEnter(mark);
    expect(container.querySelector('.cp-constellation-callout')).not.toBeNull();
  });

  it('runs the staggered rise and fade entrance when motion is allowed', () => {
    // The contrast that makes the reduced motion file meaningful: here every
    // mark starts risen and transparent under motion's control.
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const marks = Array.from(container.querySelectorAll('.cp-constellation-canvas [tabindex="0"]'));
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(mark.getAttribute('style') ?? '').toContain('translateY(8px)');
    }
  });

  it('points each mark at its annotation row through aria-describedby', () => {
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const node = CONSTELLATION_FULL_FIXTURE.nodes[0];
    const mark = screen.getByRole('button', { name: nodeAnnotation(node) });
    const describedBy = mark.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const row = container.querySelector(`#${describedBy}`);
    expect(row?.textContent).toContain(node.title);
  });
});

describe('the five states', () => {
  it('renders the loading wait ladder with a micro state, then narration', async () => {
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.loading} />);
    expect(container.querySelector('[data-rung="t1"]')).not.toBeNull();
    expect(screen.getByText('Admitting results')).toBeTruthy();
    expect(
      await screen.findByText(/Widening from this page to the corpus/, {}, { timeout: 3_000 }),
    ).toBeTruthy();
  });

  it('renders the empty state with the reason, the plain list toggle and a query edit', () => {
    const edits: string[] = [];
    render(
      <ConstellationSurface
        state={CONSTELLATION_STATE_FIXTURES.empty}
        onEditQuery={(query) => edits.push(query)}
      />,
    );
    expect(screen.getByText(/The membrane admitted nothing/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show plain list' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Edit query'), { target: { value: 'narrower question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search again' }));
    expect(edits).toEqual(['narrower question']);
  });

  it('renders the partial state with the degraded provider notes in the annotation column', () => {
    render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.partial} />);
    const notes = screen.getByRole('list', { name: 'Degraded providers' });
    expect(within(notes).getByText(/brave returned no results/)).toBeTruthy();
    expect(within(notes).getByText(/crossref refused the citation lookup/)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Nodes' })).toBeTruthy();
  });

  it('renders the error state with a named cause and a retry that fires', () => {
    let retries = 0;
    render(
      <ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.error} onRetry={() => (retries += 1)} />,
    );
    expect(screen.getByRole('alert').textContent).toContain('web_search_graph refused the subgraph handle');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retries).toBe(1);
  });

  it('renders the success state as a drawn constellation', () => {
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    expect(container.querySelector('.cp-constellation-canvas')).not.toBeNull();
    expect(container.querySelectorAll('[data-kind="result"]').length).toBe(8);
  });

  it('shows no spinner in any of the five states', () => {
    for (const state of Object.values(CONSTELLATION_STATE_FIXTURES)) {
      const { container, unmount } = render(<ConstellationSurface state={state} />);
      expect(container.querySelector(SPINNER_SELECTOR)).toBeNull();
      expect(container.textContent ?? '').not.toMatch(/loading\.\.\./i);
      unmount();
    }
  });
});

describe('plain list toggle', () => {
  it('stays one press away in every state and reveals the host list slot', () => {
    for (const state of Object.values(CONSTELLATION_STATE_FIXTURES)) {
      const presses: number[] = [];
      const { unmount } = render(
        <ConstellationSurface
          state={state}
          onShowList={() => presses.push(1)}
          listSlot={<p>Plain list from the host</p>}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Show plain list' }));
      expect(presses).toHaveLength(1);
      expect(screen.getByText('Plain list from the host')).toBeTruthy();
      unmount();
    }
  });
});
