// @vitest-environment jsdom

/**
 * Find overlay acceptance (SPEC F1): the keystroke opens it, repeat-invoking
 * widens the scope and stops at Web, a Page-scope hit reaches the in-page
 * highlight bridge with the derived target, widening to Corpus surfaces the
 * saved item, and Escape closes and returns focus to the page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FIND_SCOPE_ORDER } from '@commonplace/block-view-contracts/search-stack';

// jsdom ships no ResizeObserver and cmdk observes its list. Layout is not what
// these tests assert, so an inert observer is the honest stand-in.
class InertResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= InertResizeObserver as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

interface StubTarget {
  quote: string;
  prefix?: string;
  suffix?: string;
  positionHint?: number;
}
interface StubRectSet {
  rects: { x: number; y: number; width: number; height: number }[];
  confidence: number;
}

const bridge = vi.hoisted(() => ({
  scrollToTarget: vi.fn(async (_tabId: string, _target: unknown) => undefined),
  resolveTextTargets: vi.fn(async (_tabId: string, _targets: unknown[]) => [
    { rects: [{ x: 1, y: 2, width: 3, height: 4 }], confidence: 1 },
  ]),
  tabTintTargets: vi.fn(async (_tabId: string, _targets: unknown[], _tier: string) => undefined),
  tabClearTint: vi.fn(async (_tabId: string) => undefined),
  tabSetActive: vi.fn(async (_tabId: string | null) => undefined),
  pageIdentity: vi.fn(async () => ({ url: '', title: '', contentHash: '' })),
  isTauri: vi.fn(() => false),
  listenDesktopEvent: vi.fn(async () => () => undefined),
}));

vi.mock('@/lib/desktop', () => bridge);

// The client posts real GraphQL documents and has no fixture mode, so the test
// supplies the response by mocking the transport rather than by setting a flag.
const searchClient = vi.hoisted(() => ({
  runFind: vi.fn(),
  runScatter: vi.fn(),
  runExpand: vi.fn(),
  saveUrl: vi.fn(),
  scopeToInput: vi.fn(),
}));
vi.mock('@/lib/search-stack/client', () => searchClient);

import { FindOverlay } from '../FindOverlay';
import { useFindOverlay, widenScope } from '../useFindOverlay';
import {
  fixtureFind,
  FIXTURE_COLLECTION_NAME,
  FIXTURE_PAGE_NODE_ID,
  FIXTURE_PAGE_TEXT,
} from '@/lib/search-stack/fixtures';

const TAB_ID = 'tab-under-test';
const onOpenItem = vi.fn();

function Harness({ pageText }: { pageText?: string }) {
  const find = useFindOverlay({
    tabId: TAB_ID,
    pageNodeId: FIXTURE_PAGE_NODE_ID,
    sessionNodeIds: [FIXTURE_PAGE_NODE_ID],
    pageText,
    onOpenItem,
  });
  return (
    <>
      <span data-testid="scope">{find.scope}</span>
      <FindOverlay find={find} />
    </>
  );
}

function HarnessWithoutOpener({ pageText }: { pageText?: string }) {
  const find = useFindOverlay({
    tabId: TAB_ID,
    pageNodeId: FIXTURE_PAGE_NODE_ID,
    sessionNodeIds: [FIXTURE_PAGE_NODE_ID],
    pageText,
  });
  return (
    <>
      <span data-testid="scope">{find.scope}</span>
      <FindOverlay find={find} />
    </>
  );
}

/** The Find keystroke. Fired with both modifiers so `mod` resolves either way. */
function pressFind() {
  fireEvent.keyDown(document, { key: 'f', code: 'KeyF', metaKey: true, ctrlKey: true });
}

async function type(text: string) {
  const input = screen.getByLabelText('Find query');
  fireEvent.change(input, { target: { value: text } });
  // Clear the query debounce so the request actually fires.
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
}

beforeEach(() => {
  searchClient.runFind.mockReset();
  searchClient.runFind.mockImplementation(async (request: Parameters<typeof fixtureFind>[0]) =>
    fixtureFind(request),
  );
  bridge.scrollToTarget.mockResolvedValue(undefined);
  bridge.resolveTextTargets.mockResolvedValue([
    { rects: [{ x: 1, y: 2, width: 3, height: 4 }], confidence: 1 },
  ]);
  bridge.tabTintTargets.mockResolvedValue(undefined);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  cleanup();
});

describe('scope stepper', () => {
  it('widens Page to Session to Corpus to Web and stops at Web', () => {
    expect(widenScope('PAGE')).toBe('SESSION');
    expect(widenScope('SESSION')).toBe('CORPUS');
    expect(widenScope('CORPUS')).toBe('WEB');
    expect(widenScope('WEB')).toBe('WEB');
    expect(FIND_SCOPE_ORDER).toEqual(['PAGE', 'SESSION', 'CORPUS', 'WEB']);
  });

  it('widens one step per repeat keystroke and holds at Web', () => {
    render(<Harness />);
    pressFind();
    expect(screen.getByTestId('scope').textContent).toBe('PAGE');
    pressFind();
    expect(screen.getByTestId('scope').textContent).toBe('SESSION');
    pressFind();
    expect(screen.getByTestId('scope').textContent).toBe('CORPUS');
    pressFind();
    expect(screen.getByTestId('scope').textContent).toBe('WEB');
    pressFind();
    expect(screen.getByTestId('scope').textContent).toBe('WEB');
  });
});

describe('the overlay', () => {
  it('opens on the keystroke with the query input, lane chips and scope stepper', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog', { name: 'Find' })).toBeNull();
    pressFind();
    expect(screen.getByRole('dialog', { name: 'Find' })).toBeTruthy();
    expect(screen.getByLabelText('Find query')).toBeTruthy();
    for (const chip of ['Exact', 'Semantic', 'Graph']) {
      expect(screen.getByRole('button', { name: chip })).toBeTruthy();
    }
    for (const scope of ['Page', 'Session', 'Corpus', 'Web']) {
      expect(screen.getByRole('radio', { name: scope })).toBeTruthy();
    }
  });

  it('renders lane badge, scope badge and relation glyph on a result row', async () => {
    render(<Harness pageText={FIXTURE_PAGE_TEXT} />);
    pressFind();
    await type('budget');
    await waitFor(() => expect(screen.getByText('The membrane admits by budget')).toBeTruthy());
    const row = screen.getByText('The membrane admits by budget').closest('[data-value]');
    expect(row?.textContent).toContain('Exact');
    expect(row?.textContent).toContain('Page');
    // The relation annotation is an accessible name, not only an icon.
    expect(row?.textContent).toContain('Known');
  });

  it('sends a Page-scope hit to the in-page highlight bridge with the derived target', async () => {
    render(<Harness pageText={FIXTURE_PAGE_TEXT} />);
    pressFind();
    await type('budget');
    await waitFor(() => expect(screen.getByText('The membrane admits by budget')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByText('The membrane admits by budget'));
    });

    await waitFor(() => expect(bridge.scrollToTarget).toHaveBeenCalled());
    const [scrolledTab, rawTarget] = bridge.scrollToTarget.mock.calls[0];
    const target = rawTarget as StubTarget;
    expect(scrolledTab).toBe(TAB_ID);
    expect(target.quote).toBe('budget');
    expect(target.prefix).toBeTruthy();
    expect(target.positionHint).toBeGreaterThan(0);

    await waitFor(() => expect(bridge.tabTintTargets).toHaveBeenCalled());
    const [tintedTab, rawRects] = bridge.tabTintTargets.mock.calls[0];
    const rects = rawRects as StubRectSet[];
    expect(tintedTab).toBe(TAB_ID);
    expect(rects[0].rects.length).toBeGreaterThan(0);
    expect(onOpenItem).not.toHaveBeenCalled();
  });

  it('surfaces a notice when a Page hit cannot be located on the page', async () => {
    bridge.resolveTextTargets.mockResolvedValueOnce([{ rects: [], confidence: 0 }]);
    render(<Harness pageText={FIXTURE_PAGE_TEXT} />);
    pressFind();
    await type('budget');
    await waitFor(() => expect(screen.getByText('The membrane admits by budget')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByText('The membrane admits by budget'));
    });

    await waitFor(() =>
      expect(screen.getByText('Could not locate the selected passage on the page.')).toBeTruthy(),
    );
  });

  it('surfaces a notice when a non-Page result has no workspace opener', async () => {
    render(<HarnessWithoutOpener pageText={FIXTURE_PAGE_TEXT} />);
    pressFind();
    await type('budget');
    pressFind();
    pressFind();
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() =>
      expect(screen.getByText('Budget discipline in retrieval systems')).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Budget discipline in retrieval systems'));
    });

    await waitFor(() =>
      expect(screen.getByText('No workspace opener is available for this result.')).toBeTruthy(),
    );
  });

  it('clears a selection notice after a successful selection', async () => {
    bridge.resolveTextTargets
      .mockResolvedValueOnce([{ rects: [], confidence: 0 }])
      .mockResolvedValueOnce([{ rects: [{ x: 1, y: 2, width: 3, height: 4 }], confidence: 1 }]);
    render(<Harness pageText={FIXTURE_PAGE_TEXT} />);
    pressFind();
    await type('budget');
    await waitFor(() => expect(screen.getByText('The membrane admits by budget')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByText('The membrane admits by budget'));
    });
    await waitFor(() =>
      expect(screen.getByText('Could not locate the selected passage on the page.')).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.click(screen.getByText('The membrane admits by budget'));
    });

    await waitFor(() =>
      expect(screen.queryByText('Could not locate the selected passage on the page.')).toBeNull(),
    );
    await waitFor(() => expect(bridge.tabTintTargets).toHaveBeenCalled());
  });

  it('surfaces the saved fixture item once the scope widens to Corpus, and opens it', async () => {
    render(<Harness pageText={FIXTURE_PAGE_TEXT} />);
    pressFind();
    await type('budget');
    await waitFor(() => expect(screen.getByText('The membrane admits by budget')).toBeTruthy());
    // Page scope does not reach the corpus.
    expect(screen.queryByText('Budget discipline in retrieval systems')).toBeNull();

    pressFind(); // session
    pressFind(); // corpus
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() =>
      expect(screen.getByText('Budget discipline in retrieval systems')).toBeTruthy(),
    );
    const row = screen.getByText('Budget discipline in retrieval systems').closest('[data-value]');
    expect(row?.textContent).toContain('Corpus');
    expect(row?.textContent).toContain('Contradicts');

    // A Corpus hit opens the item rather than highlighting a page it is not on.
    await act(async () => {
      fireEvent.click(screen.getByText('Budget discipline in retrieval systems'));
    });
    await waitFor(() => expect(onOpenItem).toHaveBeenCalled());
  });

  it('closes on Escape and returns focus to the page by re-activating the stage tab', async () => {
    render(<Harness pageText={FIXTURE_PAGE_TEXT} />);
    pressFind();
    expect(screen.getByRole('dialog', { name: 'Find' })).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Find' })).toBeNull());
    expect(bridge.tabSetActive).toHaveBeenCalledWith(TAB_ID);
    expect(bridge.tabClearTint).toHaveBeenCalledWith(TAB_ID);
  });
});

describe('the corpus fixture', () => {
  it('names the collection the save receipt files into', () => {
    expect(FIXTURE_COLLECTION_NAME).toBeTruthy();
  });
});
