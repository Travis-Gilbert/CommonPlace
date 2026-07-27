// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  ConstellationPayload,
  FindResponse,
  SaveUrlReceipt,
  SearchStackClient,
} from '@commonplace/search-stack';
import { AspectList } from './AspectList';
import { ConstellationView } from './ConstellationView';
import { DockedMap } from './DockedMap';
import { LambdaDial } from './LambdaDial';
import { SaveUrlButton } from './SaveUrlButton';

const PAYLOAD: ConstellationPayload = {
  nodes: [
    {
      id: 'result-1',
      url: 'https://example.com/one',
      title: 'Budget discipline',
      description: 'A budget is a promise about attention',
      admittedRank: 1,
      relation: 'KNOWN',
    },
    {
      id: 'result-2',
      url: 'https://example.org/two',
      title: 'Open frontier',
      description: 'A separate result',
      admittedRank: 2,
      relation: 'ORPHAN',
    },
  ],
  edges: [
    {
      source: 'result-1',
      target: 'result-2',
      reason: {
        type: 'shared_source',
        text: 'Both cite the same source.',
        evidenceRefs: ['source-1'],
      },
    },
  ],
  memoryNodes: [
    {
      id: 'memory-1',
      atomRef: 'atom:memory-1',
      title: 'Budget notes',
      connectionExplanation: 'you captured this in June',
    },
  ],
  meta: {
    query: 'membrane',
    subgraphRef: 'subgraph-1',
    tokensAdmitted: 10,
    tokensDeferred: 0,
    degradedProviders: [],
  },
};

const RESPONSE: FindResponse = {
  query: 'budget',
  results: [
    {
      hit: {
        doc: 'result-1',
        byteRange: { start: 2, end: 8 },
        lane: 'EXACT',
        scope: { kind: 'CORPUS' },
        title: 'Budget discipline',
        snippet: 'A budget is a promise about attention',
        source: 'https://example.com/one',
      },
      score: 0.9,
      relation: 'KNOWN',
      edges: [],
    },
  ],
  lanes: [],
  scopesSearched: ['corpus'],
  lambda: 0.5,
  retrievalRef: 'find-1',
};

let mounted: { readonly root: Root; readonly container: HTMLDivElement }[] = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('reduce'),
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

afterEach(async () => {
  for (const view of mounted) {
    await act(async () => view.root.unmount());
    view.container.remove();
  }
  mounted = [];
});

async function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => root.render(node));
  return container;
}

describe('search result projections', () => {
  it('renders title, exact emphasis, lane, relation, and source', async () => {
    const container = await render(<AspectList response={RESPONSE} />);
    expect(container.textContent).toContain('Budget discipline');
    expect(container.querySelector('mark')?.textContent).toBe('budget');
    expect(container.textContent).toContain('Exact');
    expect(container.textContent).toContain('Known');
    expect(container.textContent).toContain('example.com');
  });

  it('opens the same result the row displays', async () => {
    const onOpen = vi.fn();
    const container = await render(
      <AspectList response={RESPONSE} onOpen={onOpen} />,
    );
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click()
    );
    expect(onOpen).toHaveBeenCalledWith(RESPONSE.results[0]);
  });
});

describe('constellation renderer', () => {
  it('renders deterministic result, edge, and gold memory marks', async () => {
    const first = await render(
      <ConstellationView state={{ kind: 'success', payload: PAYLOAD }} />,
    );
    const transforms = [...first.querySelectorAll('[data-kind="result"]')]
      .map((node) => node.getAttribute('transform'));
    const second = await render(
      <ConstellationView state={{ kind: 'success', payload: PAYLOAD }} />,
    );
    expect(
      [...second.querySelectorAll('[data-kind="result"]')]
        .map((node) => node.getAttribute('transform')),
    ).toEqual(transforms);
    expect(first.querySelector('[data-kind="memory"]')).toBeTruthy();
    expect(first.textContent).toContain('Both cite the same source.');
  });

  it('marks the static reduced-motion rendering', async () => {
    const container = await render(
      <ConstellationView state={{ kind: 'success', payload: PAYLOAD }} />,
    );
    expect(
      container.querySelector('[data-reduced-motion]')?.getAttribute(
        'data-reduced-motion',
      ),
    ).toBe('true');
  });

  it('keeps a zero-edge orphan payload honest', async () => {
    const payload = {
      ...PAYLOAD,
      nodes: PAYLOAD.nodes.map((node) => ({ ...node, relation: 'ORPHAN' as const })),
      edges: [],
      memoryNodes: [],
    };
    const container = await render(
      <ConstellationView state={{ kind: 'success', payload }} />,
    );
    expect(container.textContent).toContain(
      'No connection survived the evidence test',
    );
    expect(
      [...container.querySelectorAll('[data-kind="result"]')]
        .every((node) => node.getAttribute('data-relation') === 'ORPHAN'),
    ).toBe(true);
  });

  it('offers expand only when the host wires it', async () => {
    const onExpand = vi.fn();
    const container = await render(
      <ConstellationView
        state={{ kind: 'success', payload: PAYLOAD }}
        onExpandNode={onExpand}
      />,
    );
    const node = container.querySelector('[data-kind="result"]') as SVGGElement;
    expect(node.getAttribute('aria-label')).toContain('press E to expand');
    await act(async () =>
      node.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'e',
        bubbles: true,
      }))
    );
    expect(onExpand).toHaveBeenCalledWith(PAYLOAD.nodes[0]);
  });
});

describe('docked session map', () => {
  it('marks visited nodes and reopens without resetting state', async () => {
    const onReopen = vi.fn();
    const container = await render(
      <DockedMap
        payload={PAYLOAD}
        visited={['result-1']}
        onReopen={onReopen}
      />,
    );
    expect(container.textContent).toContain('1/2 opened');
    expect(
      container.querySelector('[data-node-id="result-1"]')?.getAttribute(
        'data-visited',
      ),
    ).toBe('true');
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click()
    );
    expect(onReopen).toHaveBeenCalledTimes(1);
  });
});

describe('controls', () => {
  it('reports and changes the lambda dial', async () => {
    const onChange = vi.fn();
    const container = await render(
      <LambdaDial lambda={0.5} onChange={onChange} />,
    );
    expect(container.querySelector('output')?.textContent).toBe('0.50');
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, '0.2');
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(0.2);
  });

  it('confirms save with the receipt collection name', async () => {
    const receipt: SaveUrlReceipt = {
      itemId: 'item-1',
      collectionId: 'collection-1',
      collectionName: 'Field notes',
      title: 'Example',
      url: 'https://example.com',
    };
    const client: SearchStackClient = {
      find: vi.fn(),
      scatter: vi.fn(),
      expand: vi.fn(),
      saveUrl: vi.fn(async () => receipt),
    };
    const container = await render(
      <SaveUrlButton url={receipt.url} client={client} />,
    );
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click()
    );
    expect(container.textContent).toContain('Saved to Field notes');
  });

  it('renders an explicit save failure', async () => {
    const client: SearchStackClient = {
      find: vi.fn(),
      scatter: vi.fn(),
      expand: vi.fn(),
      saveUrl: vi.fn(async () => {
        throw new Error('ingest unavailable');
      }),
    };
    const container = await render(
      <SaveUrlButton url="https://example.com" client={client} />,
    );
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click()
    );
    expect(container.textContent).toContain('Save failed: ingest unavailable');
  });
});
