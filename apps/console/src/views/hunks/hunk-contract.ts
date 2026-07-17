import type { JsonValue, ObjectRef, ObjectQuery } from '@commonplace/block-view/types';

export const HUNK_SOURCES = ['AgentRun', 'Briefing', 'Recalc', 'AppInstall', 'SchemaDraft'] as const;
export type HunkSource = (typeof HUNK_SOURCES)[number];
export type HunkState = 'applied' | 'proposed';
export type HunkDischarge = 'deterministic' | 'undischarged' | 'discharged';

export interface HunkStructuredValue {
  readonly descriptorId: string;
  readonly query: ObjectQuery;
}

export interface HunkSemiringDial {
  readonly supported: boolean;
  readonly independentLines: number;
  readonly weakestLink?: string;
  readonly confidence?: number;
}

export interface HunkViewModel {
  readonly hunkId: string;
  readonly source: HunkSource;
  readonly state: HunkState;
  readonly targetBlock: string;
  readonly beforeRef?: string;
  readonly afterRef: string;
  readonly beforeText?: string;
  readonly afterText?: string;
  readonly beforeStructured?: HunkStructuredValue;
  readonly afterStructured?: HunkStructuredValue;
  readonly derivationRefs: readonly string[];
  readonly discharge: HunkDischarge;
  readonly groupId?: string;
  readonly title?: string;
  readonly capabilityClass?: string;
  readonly semiring: HunkSemiringDial;
}

const HUNK_SOURCE_WIRE: Readonly<Record<string, HunkSource>> = {
  agent_run: 'AgentRun',
  briefing: 'Briefing',
  recalc: 'Recalc',
  app_install: 'AppInstall',
  schema_draft: 'SchemaDraft',
};

function record(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, JsonValue>>)
    : undefined;
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function textValue(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringList(value: JsonValue | undefined): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function enumVariant(value: JsonValue | undefined): string | undefined {
  if (typeof value === 'string') return value.toLowerCase();
  const object = record(value);
  if (typeof object?.kind === 'string') return object.kind.toLowerCase();
  const key = object ? Object.keys(object)[0] : undefined;
  return key?.toLowerCase();
}

function structuredValue(value: JsonValue | undefined): HunkStructuredValue | undefined {
  const object = record(value);
  const descriptorId = stringValue(object?.descriptor_id);
  const query = record(object?.query);
  const types = query?.types;
  if (!descriptorId || !Array.isArray(types) || !types.every((type) => typeof type === 'string')) return undefined;
  return { descriptorId, query: query as unknown as ObjectQuery };
}

function semiringDial(
  value: JsonValue | undefined,
  derivationRefs: readonly string[],
): HunkSemiringDial {
  const object = record(value);
  const confidence = typeof object?.confidence === 'number' ? object.confidence : undefined;
  return {
    supported: typeof object?.supported === 'boolean' ? object.supported : derivationRefs.length > 0,
    independentLines:
      typeof object?.independent_lines === 'number' ? object.independent_lines : derivationRefs.length,
    weakestLink: stringValue(object?.weakest_link),
    confidence,
  };
}

/**
 * The Rust crate owns Hunk compilation and classification. This adapter only
 * validates the ObjectRef wire shape and exposes it to the registered view.
 */
export function hunkFromObject(object: ObjectRef): HunkViewModel | null {
  if (object.type !== 'hunk') return null;
  const properties = object.properties;
  const sourceWire = stringValue(properties.source);
  const source = sourceWire ? HUNK_SOURCE_WIRE[sourceWire] ?? HUNK_SOURCES.find((candidate) => candidate === sourceWire) : undefined;
  const targetBlock = stringValue(properties.target_block);
  const afterRef = stringValue(properties.after_ref);
  if (!source || !targetBlock || !afterRef) return null;

  const derivationRefs = stringList(properties.derivation_refs);
  const stateVariant = enumVariant(properties.state);
  const dischargeVariant = enumVariant(properties.discharge);
  // Missing stochastic metadata on a model-authored hunk is conservative by
  // construction: it remains undischarged until a real receipt says otherwise.
  const missingModelDischarge = properties.model_authored === true && !dischargeVariant;
  const discharge: HunkDischarge = missingModelDischarge
    ? 'undischarged'
    : dischargeVariant === 'deterministic'
      ? 'deterministic'
      : dischargeVariant === 'discharged'
        ? 'discharged'
        : 'undischarged';

  return {
    hunkId: stringValue(properties.hunk_id) ?? object.id,
    source,
    state: stateVariant === 'applied' ? 'applied' : 'proposed',
    targetBlock,
    beforeRef: stringValue(properties.before_ref),
    afterRef,
    beforeText: textValue(properties.before_text),
    afterText: textValue(properties.after_text),
    beforeStructured: structuredValue(properties.before_view),
    afterStructured: structuredValue(properties.after_view),
    derivationRefs,
    discharge,
    groupId: stringValue(properties.group_id),
    title: stringValue(properties.title) ?? stringValue(record(properties.change)?.object_key),
    capabilityClass: stringValue(properties.capability_class),
    semiring: semiringDial(properties.semiring, derivationRefs),
  };
}
