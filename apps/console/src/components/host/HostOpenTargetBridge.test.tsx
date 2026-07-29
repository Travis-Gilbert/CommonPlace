// @vitest-environment jsdom
// SOURCING: vitest + react-dom: native openTarget delivery into hosted Console.

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoopbackHost, createLoopbackStore } from '@commonplace/host-bridge';
import { HostProvider } from '@/lib/commonplace-host/HostProvider';
import { HostOpenTargetBridge } from './HostOpenTargetBridge';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

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
}

describe('HostOpenTargetBridge', () => {
  it('delivers native workspace targets to the Console consumer', async () => {
    const host = new LoopbackHost(createLoopbackStore());
    const onOpenTarget = vi.fn();
    await render(
      <HostProvider host={host}>
        <HostOpenTargetBridge onOpenTarget={onOpenTarget} />
      </HostProvider>,
    );

    act(() => {
      host.publishOpenTarget('default', {
        kind: 'find',
        query: 'capture',
      });
    });

    expect(onOpenTarget).toHaveBeenCalledWith({
      kind: 'find',
      query: 'capture',
    });
  });
});
