'use client';

// SOURCING: @xyflow/react Handle — vendor the connection primitive. The
// parameter row itself renders through the host-injected widget renderer
// (issue #144 C, "widgets-on-node from generated types"), so the substrate
// never owns a second field-editor map beside the records surface.

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { SubstratePort, WidgetRenderer } from '../kinds/types';
import { familyStroke } from '../edges/law';

export interface PortRowProps {
  readonly port: SubstratePort;
  readonly Widget?: WidgetRenderer;
}

function PortRowInner({ port, Widget }: PortRowProps) {
  const isTarget = port.side === 'target';
  const dot = port.family ? familyStroke(port.family) : 'var(--ij-editor)';
  const widget = port.widget;

  return (
    <div
      className={[
        'relative flex items-center gap-2 py-0.5 text-xs text-ij-ink-info',
        isTarget ? '' : 'justify-end',
      ].join(' ')}
      data-substrate-port={port.id}
    >
      <Handle
        type={port.side}
        position={isTarget ? Position.Left : Position.Right}
        id={port.id}
        isConnectable={port.connectable !== false}
        style={{
          // The port dot wears the same family colour its outgoing wire does,
          // so a reader can tell what a port carries before drawing anything.
          background: dot,
          borderColor: 'var(--ij-seam-raised)',
          ...(typeof port.offset === 'number' ? { top: port.offset } : {}),
        }}
      />
      {isTarget ? (
        <span className="truncate font-ij-mono" data-mono-ok>
          {port.label ?? port.id}
        </span>
      ) : null}

      {widget && Widget ? (
        <span className="nodrag min-w-0 flex-1" data-substrate-widget={port.id}>
          {widget.label ? (
            <span className="mr-1 text-ij-ink-disabled">{widget.label}</span>
          ) : null}
          <Widget
            fieldType={widget.fieldType}
            value={widget.value}
            onCommit={widget.readOnly ? () => {} : widget.onCommit}
            onCancel={() => {}}
          />
        </span>
      ) : null}

      {!isTarget ? (
        <span className="truncate font-ij-mono" data-mono-ok>
          {port.label ?? port.id}
        </span>
      ) : null}
    </div>
  );
}

export const PortRow = memo(PortRowInner);
