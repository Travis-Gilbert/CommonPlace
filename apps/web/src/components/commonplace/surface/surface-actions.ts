import type {
  BlockHost,
  JsonValue,
  ObjectAction,
  ObjectQuery,
  ObjectSet,
  Result,
  ViewDescriptor,
} from '@/lib/block-view/types';

export interface SurfaceInsertOptions {
  readonly set: ObjectSet;
  readonly views: readonly ViewDescriptor[];
}

export interface CreateViewInstanceInput {
  readonly id?: string;
  readonly descriptorId: string;
  readonly title?: string;
  readonly query: ObjectQuery;
  readonly config?: Readonly<Record<string, JsonValue>>;
}

export function createViewInstanceAction(input: CreateViewInstanceInput): ObjectAction {
  return {
    kind: 'create',
    type: 'view-instance',
    props: removeUndefined({
      id: input.id,
      descriptor_id: input.descriptorId,
      title: input.title,
      query: input.query as unknown as JsonValue,
      config: (input.config ?? {}) as JsonValue,
    }),
  };
}

export function moveSurfaceNodeAction(
  id: string,
  newParent: string,
  order: number,
): ObjectAction {
  return {
    kind: 'move',
    id,
    new_parent: newParent,
    order,
  };
}

export function updateViewInstanceConfigAction(
  id: string,
  config: Readonly<Record<string, JsonValue>>,
): ObjectAction {
  return {
    kind: 'update',
    id,
    patch: {
      config: config as JsonValue,
    },
  };
}

export async function computeInsertOptions(
  host: BlockHost,
  query: ObjectQuery,
): Promise<SurfaceInsertOptions> {
  const set = await host.query(query);
  return {
    set,
    views: host.viewsFor(set.shape),
  };
}

export async function insertViewInstance(
  host: BlockHost,
  regionId: string,
  descriptor: ViewDescriptor,
  query: ObjectQuery,
  order: number,
  config: Readonly<Record<string, JsonValue>> = {},
): Promise<Result<unknown>> {
  const created = await host.emit(
    createViewInstanceAction({
      descriptorId: descriptor.id,
      title: descriptor.name,
      query,
      config,
    }),
  );
  if (!created.ok) return created;
  const instanceId = created.value?.target_ids?.[0];
  if (!instanceId) {
    return { ok: false, error: 'View instance create did not return a target id.' };
  }
  return host.emit(moveSurfaceNodeAction(instanceId, regionId, order));
}

function removeUndefined(
  input: Readonly<Record<string, JsonValue | undefined>>,
): Readonly<Record<string, JsonValue>> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined),
  );
}
