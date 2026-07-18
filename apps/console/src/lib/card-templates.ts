// SOURCING: @commonplace/block-view (ObjectRef; templates are objects on the
// data seam). Card templates are kind-templated layouts stored as data
// (HANDOFF-CARDS-ACTIONS-MENTIONS named choice 1): one engine renders any
// template; adding a kind's card is authoring a template object, not a
// component. This module owns the template shape, validation, the seeded
// person/task/generic templates, and kind resolution with the generic
// fallback (a malformed or missing template degrades, never errors).

import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';

export const CARD_TEMPLATE_TYPE = 'card_template';

/** The identity strip at the card's head: title, optional subtitle fields,
 *  optional image ref (the strip renders its no-image state until a kind
 *  carries one; verify-first note in the handoff). */
export interface CardIdentitySpec {
  readonly titleField: string;
  readonly subtitleFields?: readonly string[];
  readonly imageField?: string;
}

export interface CardFactSpec {
  readonly field: string;
  readonly label?: string;
}

/** A relation chip is a live object reference: clicking one opens the related
 *  object's card (named choice 2). `targetKind` is the type hint the opener
 *  passes so cross-kind resolution can query the right types. */
export interface CardChipSpec {
  readonly edge: string;
  readonly targetKind?: string;
  readonly label?: string;
}

/** Kind-specific gauges; progress is the seeded family (a task's progress
 *  bar). `field` holds 0..max. */
export interface CardGaugeSpec {
  readonly kind: 'progress';
  readonly field: string;
  readonly max?: number;
  readonly label?: string;
}

export interface CardTemplateSpec {
  readonly kind: string;
  readonly identity: CardIdentitySpec;
  readonly facts: readonly CardFactSpec[];
  /** When true and `facts` is empty, the engine derives fact rows from the
   *  object's own scalar properties (the generic card's behavior). */
  readonly dynamicFacts?: boolean;
  readonly chips: readonly CardChipSpec[];
  readonly gauges: readonly CardGaugeSpec[];
}

export interface ParsedCardTemplate {
  readonly spec: CardTemplateSpec | null;
  /** Present when the stored template failed validation: the engine falls
   *  back to generic and surfaces this note (K7 malformed fixture). */
  readonly note?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/** Validate a stored template payload into a spec, or return the named
 *  failure. Every field access is defensive: template objects are data and
 *  arrive from the seam, not from code. */
export function parseCardTemplate(ref: ObjectRef): ParsedCardTemplate {
  const raw = ref.properties.template;
  if (!isRecord(raw)) {
    return { spec: null, note: `template object ${ref.id} carries no template payload` };
  }
  const kind = raw.kind;
  const identity = raw.identity;
  if (typeof kind !== 'string' || !kind) {
    return { spec: null, note: `template object ${ref.id} is missing its kind` };
  }
  if (typeof ref.properties.kind !== 'string' || ref.properties.kind !== kind) {
    return { spec: null, note: `template object ${ref.id} kind does not match its payload` };
  }
  if (!isRecord(identity) || typeof identity.titleField !== 'string' || !identity.titleField) {
    return { spec: null, note: `template for "${kind}" has no identity.titleField` };
  }
  const facts: CardFactSpec[] = [];
  if (Array.isArray(raw.facts)) {
    for (const entry of raw.facts) {
      if (isRecord(entry) && typeof entry.field === 'string' && entry.field) {
        facts.push({ field: entry.field, label: typeof entry.label === 'string' ? entry.label : undefined });
      }
    }
  }
  const chips: CardChipSpec[] = [];
  if (Array.isArray(raw.chips)) {
    for (const entry of raw.chips) {
      if (isRecord(entry) && typeof entry.edge === 'string' && entry.edge) {
        chips.push({
          edge: entry.edge,
          targetKind: typeof entry.targetKind === 'string' ? entry.targetKind : undefined,
          label: typeof entry.label === 'string' ? entry.label : undefined,
        });
      }
    }
  }
  const gauges: CardGaugeSpec[] = [];
  if (Array.isArray(raw.gauges)) {
    for (const entry of raw.gauges) {
      if (isRecord(entry) && entry.kind === 'progress' && typeof entry.field === 'string' && entry.field) {
        gauges.push({
          kind: 'progress',
          field: entry.field,
          max: typeof entry.max === 'number' && entry.max > 0 ? entry.max : undefined,
          label: typeof entry.label === 'string' ? entry.label : undefined,
        });
      }
    }
  }
  return {
    spec: {
      kind,
      identity: {
        titleField: identity.titleField,
        subtitleFields: stringArray(identity.subtitleFields),
        imageField: typeof identity.imageField === 'string' ? identity.imageField : undefined,
      },
      facts,
      dynamicFacts: raw.dynamicFacts === true,
      chips,
      gauges,
    },
  };
}

export const GENERIC_TEMPLATE_ID = 'card-template-generic';

function templateObject(kind: string, template: Record<string, JsonValue>): ObjectRef {
  return {
    id: kind === 'generic' ? GENERIC_TEMPLATE_ID : `card-template-${kind}`,
    type: CARD_TEMPLATE_TYPE,
    properties: { kind, title: `${kind} card`, template },
  };
}

/** The three seeded templates (K1): person, task, generic. Skills, orgs, and
 *  projects are objects reached through chips, not strings. */
export function seedCardTemplates(): ObjectRef[] {
  return [
    templateObject('person', {
      kind: 'person',
      identity: { titleField: 'title', subtitleFields: ['role'], imageField: 'image' },
      facts: [
        { field: 'email', label: 'Email' },
        { field: 'location', label: 'Location' },
      ],
      chips: [
        { edge: 'WORKS_AT', targetKind: 'org', label: 'Org' },
        { edge: 'HAS_SKILL', targetKind: 'skill', label: 'Skills' },
        { edge: 'IN_PROJECT', targetKind: 'project', label: 'Projects' },
      ],
      gauges: [],
    }),
    templateObject('task', {
      kind: 'task',
      identity: { titleField: 'title', subtitleFields: ['status'] },
      facts: [
        { field: 'status', label: 'Status' },
        { field: 'priority', label: 'Priority' },
        { field: 'due', label: 'Due' },
      ],
      chips: [
        { edge: 'IN_PROJECT', targetKind: 'project', label: 'Project' },
        { edge: 'DEPENDS_ON', targetKind: 'task', label: 'Depends on' },
      ],
      gauges: [{ kind: 'progress', field: 'progress', max: 100, label: 'Progress' }],
    }),
    templateObject('generic', {
      kind: 'generic',
      identity: { titleField: 'title' },
      facts: [],
      dynamicFacts: true,
      chips: [],
      gauges: [],
    }),
  ];
}

export interface ResolvedCardTemplate {
  readonly spec: CardTemplateSpec;
  /** Set when resolution fell back to generic because the kind's template was
   *  missing or malformed; the card surfaces the note honestly. */
  readonly fallbackNote?: string;
}

const BUILTIN_GENERIC: CardTemplateSpec = {
  kind: 'generic',
  identity: { titleField: 'title' },
  facts: [],
  dynamicFacts: true,
  chips: [],
  gauges: [],
};

/** Resolve the template for an object kind against the template objects the
 *  seam served. An object of a kind with no template renders the generic
 *  card, never an error (K1 acceptance). */
export function resolveCardTemplate(
  templates: readonly ObjectRef[],
  kind: string,
): ResolvedCardTemplate {
  const parsedByKind = new Map<string, ParsedCardTemplate>();
  for (const ref of templates) {
    const declared = typeof ref.properties.kind === 'string' ? ref.properties.kind : '';
    if (declared && !parsedByKind.has(declared)) parsedByKind.set(declared, parseCardTemplate(ref));
  }
  const exact = parsedByKind.get(kind);
  if (exact?.spec) return { spec: exact.spec };
  const generic = parsedByKind.get('generic');
  const genericSpec = generic?.spec ?? BUILTIN_GENERIC;
  if (exact && !exact.spec) {
    return { spec: genericSpec, fallbackNote: exact.note ?? `template for "${kind}" is malformed` };
  }
  return { spec: genericSpec };
}

/** The dynamic fact rows for the generic card: the object's scalar properties
 *  minus the identity fields, capped so the card stays a card. */
export function dynamicFactRows(
  object: ObjectRef,
  spec: CardTemplateSpec,
  cap = 5,
): readonly CardFactSpec[] {
  const excluded = new Set<string>([
    spec.identity.titleField,
    ...(spec.identity.subtitleFields ?? []),
    spec.identity.imageField ?? '',
  ]);
  const rows: CardFactSpec[] = [];
  for (const [field, value] of Object.entries(object.properties)) {
    if (excluded.has(field)) continue;
    if (value === null || typeof value === 'object') continue;
    rows.push({ field });
    if (rows.length >= cap) break;
  }
  return rows;
}
