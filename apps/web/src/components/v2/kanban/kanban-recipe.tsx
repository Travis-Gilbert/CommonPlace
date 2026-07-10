// Kanban card recipe: renders individual field values with type-appropriate
// formatting, and chooses which fields lead a card based on the object's type.
// Simple inline rendering, not a full inline editor (inline edit is TW2 table
// territory; kanban cards are read-only with drag as the primary interaction).

import type { JsonValue, ObjectRef } from '@/lib/block-view/types';

/** Renders a single field value for display on a kanban card.
 *  Returns a React element or null for empty values. */
export function renderCardField(field: string, value: JsonValue): React.ReactNode {
  // Title field gets prominence
  const isTitle = field === 'title' || field === 'name';

  if (value === null || value === undefined) {
    return (
      <span className="kb-field-empty" data-field={field}>
        <span className="kb-field-label">{formatLabel(field)}</span>
        <span className="kb-field-value kb-empty">·</span>
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
        <span className="kb-field-value">{value.join(', ') || '·'}</span>
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

// Title-like fields in preference order. The first one an object actually has
// becomes the card's lead line, which is why this list, not the object type,
// decides the title (a task leads with "title", a person with "name", a
// document with "headline"): the type only biases the SECONDARY fields below.
const TITLE_FIELDS = ['title', 'name', 'label', 'headline', 'summary'] as const;

// Secondary field names that tend to carry the most signal on a card, highest
// first. This is a field-ordering heuristic over property NAMES: it never
// invents a field, it only ranks the ones an object already has.
const LEAD_FIELDS = [
  'status', 'state', 'stage',
  'priority', 'severity',
  'assignee', 'owner', 'author', 'user',
  'due', 'deadline', 'date', 'start', 'end',
  'category', 'kind', 'tags', 'tag',
  'amount', 'value', 'total', 'count', 'score',
  'email', 'phone', 'company', 'role',
] as const;

// Coarse type families. Each maps tokens that may appear in an ObjectRef.type to
// the field tokens that lead for that family, so the object's type BOOSTS the
// ordering without hardcoding a rigid per-type field list. An unrecognised type
// contributes no boost and falls back to the name heuristic above.
const TYPE_AFFINITIES: ReadonlyArray<{
  types: readonly string[];
  fields: readonly string[];
}> = [
  {
    types: ['task', 'issue', 'ticket', 'todo', 'bug', 'story', 'card'],
    fields: ['status', 'state', 'priority', 'assignee', 'due'],
  },
  {
    types: ['person', 'contact', 'user', 'member', 'lead', 'customer', 'people'],
    fields: ['email', 'phone', 'company', 'role'],
  },
  {
    types: ['event', 'meeting', 'session', 'appointment'],
    fields: ['date', 'start', 'end', 'time', 'location'],
  },
  {
    types: ['deal', 'invoice', 'order', 'payment', 'opportunity'],
    fields: ['amount', 'value', 'total', 'stage', 'status'],
  },
];

/** Pick the field that should lead a card for this object, or null when the
 *  object has none of the known title fields. */
export function pickTitleField(object: ObjectRef): string | null {
  return TITLE_FIELDS.find((f) => f in object.properties) ?? null;
}

export interface SelectCardFieldsOptions {
  /** Field the board groups columns by; excluded because the column encodes it. */
  groupField?: string;
  /** Maximum number of fields to return, title included. Defaults to 4. */
  limit?: number;
}

/** Choose which fields lead a card: type-aware and data-driven. The object's
 *  `type` biases the ordering (a task surfaces status/priority, a person
 *  surfaces email/role) but only fields the object actually has are ever
 *  returned, so an unknown type degrades to a sensible generic ordering. */
export function selectCardFields(
  object: ObjectRef,
  options: SelectCardFieldsOptions = {},
): string[] {
  const { groupField, limit = 4 } = options;
  const titleCandidate = pickTitleField(object);
  const title =
    titleCandidate && titleCandidate !== groupField ? titleCandidate : null;

  const ranked = Object.keys(object.properties)
    .filter((key) => key !== 'id' && key !== groupField && key !== title)
    .map((key, index) => ({ key, index, score: fieldScore(object.type, key) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.key);

  const ordered = title ? [title, ...ranked] : ranked;
  return ordered.slice(0, Math.max(0, limit));
}

// ── Helpers ──

function formatLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Score a field for card prominence: base rank from the name heuristic plus a
 *  type-family boost large enough to outrank any non-matching lead field. */
function fieldScore(type: string, field: string): number {
  const name = field.toLowerCase();
  const leadIndex = LEAD_FIELDS.findIndex((l) => name === l || name.includes(l));
  const base = leadIndex === -1 ? 0 : LEAD_FIELDS.length - leadIndex;
  return base + typeAffinity(type, name) * (LEAD_FIELDS.length + 1);
}

function typeAffinity(type: string, field: string): number {
  const t = type.toLowerCase();
  for (const affinity of TYPE_AFFINITIES) {
    if (
      affinity.types.some((token) => t.includes(token)) &&
      affinity.fields.some((token) => field.includes(token))
    ) {
      return 1;
    }
  }
  return 0;
}
