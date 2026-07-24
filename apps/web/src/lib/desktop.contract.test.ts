// @vitest-environment jsdom
/**
 * Contract test (HANDOFF-COBROWSE-PRESENCE D1): deserializes a browse-with-me
 * response captured from the real engine handler. The fixture is emitted by
 * the Rust test `browse_with_me_live_session_previews_then_confirms_action`
 * (rustyred-thg-server/src/router.rs) with EMIT_BROWSE_WITH_ME_FIXTURE set;
 * regenerate it there whenever the engine contract changes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import captured from './__fixtures__/browse-with-me.captured.json';
import { parseBrowsePerception, proposedActionOf, resolveTextTargets } from './desktop';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe('browse-with-me contract (captured from the real handler)', () => {
  it('deserializes the preview response with no unknown left on the path', () => {
    const preview = parseBrowsePerception(captured.preview);
    expect(preview.surface).toBe('browse_with_me');
    expect(preview.control_mode).toBe('pair');
    expect(preview.live_browser?.status).toBe('preview_pending');
    expect(preview.live_browser?.pending_action?.action).toBe('fill');
    expect(preview.perception.candidates.length).toBeGreaterThan(0);
    expect(preview.action_rail.actions.length).toBeGreaterThan(0);
    expect(preview.browsing_run.events).toContain('browsing_run.receipt.emitted');
  });

  it('carries the node-resolved present-tense intent line', () => {
    const preview = parseBrowsePerception(captured.preview);
    expect(preview.live_browser?.intent).toMatch(/^Filling/);
    const actuated = parseBrowsePerception(captured.actuated);
    expect(actuated.live_browser?.status).toBe('actuated');
    expect(actuated.live_browser?.intent).toMatch(/^Filling/);
    expect(actuated.live_browser?.action_receipt?.applied).toBe(true);
  });

  it('normalizes the held preview into the proposed_action shape', () => {
    const preview = parseBrowsePerception(captured.preview);
    const proposal = proposedActionOf(preview);
    expect(proposal).not.toBeNull();
    expect(proposal?.verb).toBe('fill');
    expect(proposal?.intent).toMatch(/^Filling/);
    // fill writes into the page, so it is confirm-gated (routes to D5).
    expect(proposal?.confirm).toBe(true);
    // After actuation nothing is pending.
    expect(proposedActionOf(parseBrowsePerception(captured.actuated))).toBeNull();
  });

  it('rejects a drifted body loudly', () => {
    expect(() => parseBrowsePerception({ run_id: 42 })).toThrow(/run_id/);
    expect(() => parseBrowsePerception(null)).toThrow();
  });
});

describe('margin-recall target resolution', () => {
  it('times out to an empty rect set and unregisters the listener', async () => {
    vi.useFakeTimers();
    const invoke = vi.fn(async (cmd: string) =>
      cmd === 'plugin:event|listen' ? 42 : undefined,
    );
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        invoke,
        transformCallback: vi.fn(() => 7),
      },
    });

    const result = resolveTextTargets('tab-1', [{ quote: 'needle' }]);
    await Promise.resolve();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual([{ rects: [], confidence: 0 }]);
    expect(invoke).toHaveBeenCalledWith('plugin:event|unlisten', {
      event: 'marginrecall://targets',
      eventId: 42,
    });
  });
});
