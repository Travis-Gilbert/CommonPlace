// @vitest-environment jsdom
// SOURCING: vitest + react-dom: F2 rail click-to-add (SPEC F2).

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopbackHost, createLoopbackStore } from '@commonplace/host-bridge';
import { HostProvider } from '@/lib/commonplace-host/HostProvider';
import { HostCapabilityRailBridge } from './HostCapabilityRailBridge';

let root: Root | null;
let container: HTMLDivElement | null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(node));
  return container;
}

describe('HostCapabilityRailBridge', () => {
  it('click-to-add invokes placeBlock with the contribution paneKind', async () => {
    const store = createLoopbackStore({
      contributions: [{ id: 'pane.note', paneKind: 'note', label: 'Note' }],
    });
    const host = new LoopbackHost(store);
    const placeBlock = vi.spyOn(host, 'placeBlock');

    const view = await render(
      <HostProvider host={host}>
        <HostCapabilityRailBridge workspaceId="default" />
      </HostProvider>,
    );

    const button = view.querySelector(
      '[data-rail-id="pane.note"]',
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    await act(async () => {
      button!.click();
    });

    expect(placeBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'default',
        kind: 'note',
        attrs: { fromRail: 'pane.note' },
      }),
    );
    expect(view.querySelector('[data-last-placed]')).toBeTruthy();
  });
});
