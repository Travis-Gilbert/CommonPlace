'use client';

// SOURCING: apps/console/src/views/records/editors.tsx FieldEditor — reuse the
// records surface's own editor map for widgets-on-node rather than growing a
// second one (issue 144 C).
//
// The substrate keeps `fieldType` opaque so it never has to know the field-type
// union; this adapter is the one place that narrows it, and it narrows through
// `parseFieldType` so an unrecognised shape degrades to a text control instead
// of rendering nothing.

import { parseFieldType } from '@commonplace/data-model-contracts';
import type { WidgetRenderProps } from '@commonplace/canvas-substrate';
import { FieldEditor } from '../records/editors';

export function ProgramWidget({ fieldType, value, onCommit, onCancel }: WidgetRenderProps) {
  return (
    <FieldEditor
      fieldType={parseFieldType(fieldType)}
      value={value}
      onCommit={onCommit}
      onCancel={onCancel}
      autoFocus={false}
    />
  );
}
