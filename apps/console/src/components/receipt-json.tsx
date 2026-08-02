'use client';

// SOURCING: twenty-ui `JsonTree` (packages/twenty-ui/src/json-visualizer, hard
// fork). SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0 TU6.
//
// The one JSON surface in this app. Harness receipts, tool results, and object
// excerpts all render through it, in inspector rails and inside blocks.
//
// It replaces the jalco JsonViewer, which carried 65 shiki editor themes: a
// second theming system beside the register, which is the disease the fork
// exists to cure. Colour here comes from the token generator through the fork's
// --t-* layer, so a receipt in a block and a record cell resolve to one paint.

import type { JsonValue } from 'type-fest';
import { JsonTree } from 'twenty-ui/json-visualizer';

export interface ReceiptJsonProps {
  readonly data: unknown;
  /**
   * Depth expanded on first render. Receipts open one level so the shape reads
   * without the payload filling the rail.
   */
  readonly defaultExpanded?: number;
  readonly className?: string;
  /** Fires with the clicked node's value, for copy-to-clipboard affordances. */
  readonly onValueClick?: (value: string) => void;
}

export function ReceiptJson({
  data,
  defaultExpanded = 1,
  className,
  onValueClick,
}: ReceiptJsonProps) {
  return (
    <div className={className} data-receipt-json>
      <JsonTree
        value={data as JsonValue}
        shouldExpandNodeInitially={({ depth }) => depth < defaultExpanded}
        emptyArrayLabel="Empty list"
        emptyObjectLabel="Empty object"
        emptyStringLabel="Empty string"
        arrowButtonCollapsedLabel="Expand"
        arrowButtonExpandedLabel="Collapse"
        onNodeValueClick={onValueClick}
      />
    </div>
  );
}
