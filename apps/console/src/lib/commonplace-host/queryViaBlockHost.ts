// SOURCING: @commonplace/host-bridge ObjectQuery + ConsoleBlockHost — maps
// block-view object sets onto the host-bridge HostObject shape so the web
// adapter never talks to apps/web GraphQL.

import type { ObjectQuery, ObjectSet } from '@commonplace/host-bridge';
import type { ConsoleBlockHost } from '@/lib/console-host';

const DEFAULT_TYPES = [
  'record',
  'person',
  'task',
  'project',
  'org',
  'doc',
] as const;

/**
 * Bridge ConsoleBlockHost.query into CommonplaceHost.queryObjects.
 */
export async function queryViaBlockHost(
  blockHost: ConsoleBlockHost,
  q: ObjectQuery,
): Promise<ObjectSet> {
  const types = q.kinds?.length ? q.kinds : [...DEFAULT_TYPES];
  const set = await Promise.resolve(
    blockHost.query({
      types,
      where: q.text?.trim()
        ? { kind: 'contains', field: 'title', value: q.text.trim() }
        : q.ids?.length === 1
          ? { kind: 'eq', field: 'id', value: q.ids[0] }
          : undefined,
      page: { limit: q.limit ?? 50 },
    }),
  );

  let objects = [...set.objects];
  if (q.ids?.length) {
    const want = new Set(q.ids);
    objects = objects.filter((object) => want.has(object.id));
  }

  return {
    total: objects.length,
    objects: objects.map((object) => ({
      id: object.id,
      kind: object.type,
      title: String(object.properties.title ?? object.id),
      body:
        typeof object.properties.body === 'string'
          ? object.properties.body
          : typeof object.properties.bodyText === 'string'
            ? object.properties.bodyText
            : undefined,
      attrs: { ...object.properties },
    })),
  };
}
