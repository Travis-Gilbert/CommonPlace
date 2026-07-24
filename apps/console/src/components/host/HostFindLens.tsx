// SOURCING: @commonplace/host-bridge HostLens — find-highlight overlay inside
// the React surface (SPEC F1). Native/Servo lenses stay in their realms.

'use client';

import { useEffect, useState } from 'react';
import type { HostLens } from '@commonplace/host-bridge';
import { useHost } from '@/lib/commonplace-host/HostProvider';

export interface HostFindLensProps {
  workspaceId?: string;
  surface?: string;
}

/**
 * Renders find-highlight spans from bridge lens events. Spans are character
 * offsets into the focused block; without a block body we draw a soft band so
 * the handoff still reads as one continuous find across realms.
 */
export function HostFindLens({
  workspaceId = 'default',
  surface = 'commonplace',
}: HostFindLensProps) {
  const host = useHost();
  const [lens, setLens] = useState<HostLens | null>(null);

  useEffect(() => {
    return host.subscribeWorkspace(workspaceId, (e) => {
      if (e.type === 'lens' && e.lens.surface === surface) {
        setLens(e.lens.spans.length > 0 ? e.lens : null);
      }
    });
  }, [host, workspaceId, surface]);

  if (!lens || lens.spans.length === 0) return null;

  return (
    <div
      aria-hidden
      data-host-lens="1"
      data-host-lens-spans={lens.spans.length}
      className="pointer-events-none absolute inset-x-0 top-0 z-[14]"
    >
      {lens.spans.map((span, index) => (
        <div
          key={`${span.start}-${span.end}-${index}`}
          data-lens-span={index}
          title={span.quote}
          className="mx-3 mt-2 rounded-ij-arc border border-ij-accent/30 bg-ij-accent/10 px-2 py-1 font-ij-mono text-[11px] text-ij-ink"
        >
          {span.quote ?? `find ${span.start}–${span.end}`}
        </div>
      ))}
    </div>
  );
}
