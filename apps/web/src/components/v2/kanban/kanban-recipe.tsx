// Kanban card recipe — renders individual field values with type-appropriate
// formatting. Simple inline rendering, not a full inline editor (inline edit
// is TW2 table territory; kanban cards are read-only with drag as the primary
// interaction).

import type { JsonValue } from '@/lib/block-view/types';

/** Renders a single field value for display on a kanban card.
 *  Returns a React element or null for empty values. */
export function renderCardField(field: string, value: JsonValue): React.ReactNode {
  // Title field gets prominence
  const isTitle = field === 'title' || field === 'name';

  if (value === null || value === undefined) {
    return (
      <span className="kb-field-empty" data-field={field}>
        <span className="kb-field-label">{formatLabel(field)}</span>
        <span className="kb-field-value kb-empty">—</span>
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className="kb-field-bool" data-field={field}>
        <span className="kb-field-label">{formatLabel(field)}</span>
        <span className="kb-field-value">{value ? '✓' : '✗'}</span>
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <span className="kb-field-list" data-field={field}>
        <span className="kb-field-label">{formatLabel(field)}</span>
        <span className="kb-field-value">{value.join(', ') || '—'}</span>
      </span>
    );
  }

  if (typeof value === 'object') {
    return (
      <span className="kb-field-json" data-field={field}>
        <span className="kb-field-label">{formatLabel(field)}</span>
        <span className="kb-field-value kb-mono">{JSON.stringify(value)}</span>
      </span>
    );
  }

  const text = String(value);
  if (isTitle) {
    return (
      <span className="kb-field-title" data-field={field}>
        <span className="kb-title-text">{text}</span>
      </span>
    );
  }

  return (
    <span className="kb-field-text" data-field={field}>
      <span className="kb-field-label">{formatLabel(field)}</span>
      <span className="kb-field-value">{text}</span>
    </span>
  );
}

// ── Helpers ──

function formatLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
