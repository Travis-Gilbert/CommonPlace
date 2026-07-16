/**
 * Co-browse surface tests: D2 request capture (each segment's control_mode on
 * the wire), D5 keyboard semantics, D6 rail order + expansion + virtualization,
 * D7 five view states, and the presence state definitions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { browseWithMe, parseBrowsePerception } from '@/lib/desktop';
import { viewState } from '@/lib/commonplace-view-state';
import captured from '@/lib/__fixtures__/browse-with-me.captured.json';
import { ControlSpectrum } from '../ControlSpectrum';
import { ApprovalCard } from '../ApprovalCard';
import { ReceiptRail } from '../ReceiptRail';
import { PerceptionCards } from '../PerceptionCards';
import { MODE_TO_CONTROL, type CoBrowseMode, type RailEntry } from '../useCoBrowseSession';
import {
  constellationFor,
  isAnimated,
  PRESENCE_STATES,
} from '../../presence/presenceStates';

afterEach(cleanup);

describe('D2 control spectrum', () => {
  it('maps Watch/Pair/Drive to the engine control modes', () => {
    expect(MODE_TO_CONTROL.watch).toBe('agent_drive');
    expect(MODE_TO_CONTROL.pair).toBe('pair');
    expect(MODE_TO_CONTROL.drive).toBe('human_drive');
  });

  it('fires on pointer-down, one press per segment', () => {
    const onChange = vi.fn();
    render(<ControlSpectrum mode="pair" onChange={onChange} />);
    fireEvent.pointerDown(screen.getByRole('radio', { name: 'Watch' }));
    fireEvent.pointerDown(screen.getByRole('radio', { name: 'Drive' }));
    expect(onChange).toHaveBeenNthCalledWith(1, 'watch');
    expect(onChange).toHaveBeenNthCalledWith(2, 'drive');
  });

  it('puts each segment mode on the wire as control_mode (request capture)', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(captured.preview), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      for (const mode of ['watch', 'pair', 'drive'] as CoBrowseMode[]) {
        await browseWithMe({ runId: 'wire-test', controlMode: MODE_TO_CONTROL[mode] });
      }
      expect(bodies.map((body) => body.control_mode)).toEqual([
        'agent_drive',
        'pair',
        'human_drive',
      ]);
      expect(bodies.every((body) => body.wait === true)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('D5 approval card', () => {
  const perception = parseBrowsePerception(captured.preview);
  const proposal = {
    verb: 'fill',
    targetDescriptor: 'Name',
    intent: 'Filling "Name" with "Travis"',
    confirm: true,
    raw: { selector: { element_id: 'name' }, action: 'fill', value: 'Travis' },
  };

  it('renders what, why, and blast radius, and honors Enter and Escape', () => {
    const onApprove = vi.fn();
    const onDecline = vi.fn();
    render(
      <ApprovalCard
        proposal={proposal}
        perception={perception}
        onApprove={onApprove}
        onDecline={onDecline}
      />,
    );
    expect(screen.getByText('What')).toBeDefined();
    expect(screen.getByText('Why')).toBeDefined();
    expect(screen.getByText('Blast radius')).toBeDefined();
    expect(screen.getAllByText(/Filling "Name"/).length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onApprove).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});

describe('D6 receipt rail', () => {
  beforeEach(() => {
    // jsdom reports zero-size boxes; give the virtualizer real geometry.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });
  afterEach(() => vi.restoreAllMocks());

  const entry = (index: number): RailEntry => ({
    id: `entry-${index}`,
    at: 1700000000000 + index,
    kind: index % 3 === 0 ? 'action' : index % 3 === 1 ? 'intent' : 'capture',
    summary: `Step ${index}`,
    receipt: { run_id: `run-${index}`, status: 'ok' },
  });

  it('lists entries in order and expands one to its receipt fields', () => {
    const entries = [0, 1, 2].map(entry);
    render(<ReceiptRail entries={entries} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /Receipts/ }));
    const rows = screen.getAllByText(/^Step \d/);
    expect(rows.map((row) => row.textContent)).toEqual(['Step 0', 'Step 1', 'Step 2']);
    fireEvent.pointerDown(rows[1].closest('button')!);
    expect(screen.getByText(/run_id: run-1/)).toBeDefined();
  });

  it('virtualizes a 200-entry fixture instead of mounting every row', () => {
    const entries = Array.from({ length: 200 }, (_, index) => entry(index));
    render(<ReceiptRail entries={entries} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /Receipts/ }));
    expect(screen.getByText('200 entries')).toBeDefined();
    const mounted = screen.getAllByText(/^Step \d+/).length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(200);
  });
});

describe('D7 perception cards, five states', () => {
  const noop = () => undefined;

  it('renders the designed empty state', () => {
    render(<PerceptionCards state={viewState.empty()} onRunSuggested={noop} />);
    expect(screen.getByText(/No co-browse session yet/)).toBeDefined();
  });

  it('renders nothing inside the T0 loading window (wait ladder)', () => {
    const { container } = render(
      <PerceptionCards state={viewState.loading()} onRunSuggested={noop} />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders the designed error state with retry', () => {
    const retry = vi.fn();
    render(
      <PerceptionCards state={viewState.error('node unreachable', retry)} onRunSuggested={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('renders the three cards from the captured perception (success)', () => {
    const perception = parseBrowsePerception(captured.preview);
    render(<PerceptionCards state={viewState.success(perception)} onRunSuggested={noop} />);
    expect(screen.getByText('What I see')).toBeDefined();
    expect(screen.getByText('What I can do here')).toBeDefined();
    expect(screen.getByText('Suggested next')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Do it' })).toBeDefined();
    // Raw JSON never renders on the surface.
    expect(document.body.textContent).not.toContain('{"');
  });

  it('renders partial data while streaming (partial)', () => {
    const perception = parseBrowsePerception(captured.preview);
    render(<PerceptionCards state={viewState.partial(perception)} onRunSuggested={noop} />);
    expect(screen.getByText('What I see')).toBeDefined();
  });
});

describe('presence state definitions', () => {
  it('defines all six states with deterministic, distinct constellations', () => {
    expect(PRESENCE_STATES).toHaveLength(6);
    const signatures = PRESENCE_STATES.map((state) =>
      JSON.stringify(constellationFor(state, 5)),
    );
    expect(new Set(signatures).size).toBe(6);
    // Deterministic: the same state always renders the same form.
    expect(JSON.stringify(constellationFor('idle', 5))).toBe(signatures[0]);
  });

  it('animates only the moving, telegraphing, acting, and thinking states', () => {
    expect(isAnimated('idle')).toBe(false);
    expect(isAnimated('interrupted')).toBe(false);
    expect(isAnimated('moving')).toBe(true);
    expect(isAnimated('telegraphing')).toBe(true);
    expect(isAnimated('acting')).toBe(true);
    expect(isAnimated('thinking')).toBe(true);
  });
});
