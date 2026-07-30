// SOURCING: rustyred-thg-mcp records_presence.rs (SPEC-MODEL-CANVAS-RECORDS RT7).
// View-scoped presence vocabulary: humans and heads publish the same event kinds.

export type ViewPresenceActor = {
  readonly actorId: string;
  readonly actorKind: 'human' | 'head';
  readonly viewId: string;
  readonly recordId?: string;
};

export const VIEW_PRESENCE_KIND = 'view.presence';
export const VIEW_FOCUS_KIND = 'view.focus';
export const VIEW_LEAVE_KIND = 'view.leave';

const PRESENCE_KINDS = new Set<string>([
  VIEW_PRESENCE_KIND,
  VIEW_FOCUS_KIND,
  VIEW_LEAVE_KIND,
]);

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Parse coordination stream events into normalized view presence actors. */
export function parsePresenceEvents(events: unknown[]): ViewPresenceActor[] {
  const actors: ViewPresenceActor[] = [];

  for (const event of events) {
    const record = asRecord(event);
    if (!record) continue;

    const kind = readString(record, 'kind', 'type');
    if (!kind || !PRESENCE_KINDS.has(kind)) continue;
    if (kind === VIEW_LEAVE_KIND) continue;

    const payload = asRecord(record.payload) ?? record;
    const viewId = readString(payload, 'viewId', 'view_id');
    if (!viewId) continue;

    const actorId = readString(record, 'actorId', 'actor_id', 'actor')
      ?? readString(payload, 'actorId', 'actor_id');
    if (!actorId) continue;

    const actorKindRaw = readString(payload, 'actorKind', 'actor_kind') ?? 'human';
    const actorKind = actorKindRaw === 'head' ? 'head' : 'human';
    const recordId = readString(payload, 'recordId', 'record_id');

    actors.push({
      actorId,
      actorKind,
      viewId,
      ...(recordId ? { recordId } : {}),
    });
  }

  return actors;
}

/** Map record ids to the actor that currently soft-focuses them. */
export function focusedRecordIds(
  actors: readonly ViewPresenceActor[],
  excludeActorId?: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const actor of actors) {
    if (excludeActorId && actor.actorId === excludeActorId) continue;
    if (!actor.recordId) continue;
    map.set(actor.recordId, actor.actorId);
  }
  return map;
}
