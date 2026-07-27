// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  FindRequest,
  FindResponse,
  SearchStackClient,
  TextTarget,
} from '@commonplace/search-stack';
import { FindOverlay } from './FindOverlay';

const RESPONSE: FindResponse = {
  query: 'budget',
  results: [
    {
      hit: {
        doc: 'page-1',
        byteRange: { start: 2, end: 8 },
        lane: 'EXACT',
        scope: { kind: 'PAGE', nodeId: 'page-1' },
        snippet: 'A budget is a promise',
        title: 'Budget discipline',
        source: 'https://example.com',
      },
      score: 0.9,
      relation: 'KNOWN',
      edges: [],
    },
  ],
  lanes: [],
  scopesSearched: ['page'],
  lambda: 0.8,
  retrievalRef: 'find-1',
};

let root: Root | null;
let container: HTMLDivElement | null;
let client: SearchStackClient;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  class InertResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = InertResizeObserver as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => undefined;
  client = {
    find: vi.fn(async (request: FindRequest) => ({
      ...RESPONSE,
      query: request.query,
    })),
    scatter: vi.fn(),
    expand: vi.fn(),
    saveUrl: vi.fn(),
  };
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

async function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(node));
  return container;
}

function press(key: string, init: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...init,
  }));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
}

async function queryBudget(target: HTMLDivElement) {
  const input = target.querySelector('[aria-label="Find query"]') as HTMLInputElement;
  await act(async () => {
    setInputValue(input, 'budget');
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: 'budget',
    }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

describe('find overlay', () => {
  it('opens with lanes and the scope stepper', async () => {
    const view = await render(<FindOverlay client={client} pageNodeId="page-1" />);
    await act(async () => press('f', { ctrlKey: true }));
    expect(view.querySelector('[role="dialog"]')).toBeTruthy();
    expect(view.textContent).toContain('Exact');
    expect(view.textContent).toContain('Semantic');
    expect(view.textContent).toContain('Graph');
    expect(view.textContent).toContain('Corpus');
  });

  it('repeat invoking widens one scope and stops at Web', async () => {
    const view = await render(<FindOverlay client={client} pageNodeId="page-1" />);
    for (const expected of ['PAGE', 'SESSION', 'CORPUS', 'WEB', 'WEB']) {
      await act(async () => press('f', { metaKey: true }));
      const checked = view.querySelector('[role="radio"][aria-checked="true"]');
      expect(checked?.textContent?.toUpperCase()).toBe(expected);
    }
  });

  it('renders attributed results and derives a page target', async () => {
    const onHighlightPageHit = vi.fn(
      async (_result: unknown, _target: TextTarget) => undefined,
    );
    const view = await render(
      <FindOverlay
        client={client}
        pageNodeId="page-1"
        pageText="A budget is a promise"
        onHighlightPageHit={onHighlightPageHit}
      />,
    );
    await act(async () => press('f', { ctrlKey: true }));
    await queryBudget(view);
    expect(view.textContent).toContain('Budget discipline');
    expect(view.textContent).toContain('Known');
    const item = view.querySelector('[cmdk-item]') as HTMLElement;
    await act(async () => item.click());
    expect(onHighlightPageHit).toHaveBeenCalledTimes(1);
    expect(onHighlightPageHit.mock.calls[0][1].quote).toBe('budget');
  });

  it('closes on Escape and returns focus through the host callback', async () => {
    const onReturnFocus = vi.fn();
    const view = await render(
      <FindOverlay
        client={client}
        pageNodeId="page-1"
        onReturnFocus={onReturnFocus}
      />,
    );
    await act(async () => press('f', { ctrlKey: true }));
    expect(view.querySelector('[role="dialog"]')).toBeTruthy();
    await act(async () => press('Escape'));
    expect(view.querySelector('[role="dialog"]')).toBeNull();
    expect(onReturnFocus).toHaveBeenCalledTimes(1);
  });
});
