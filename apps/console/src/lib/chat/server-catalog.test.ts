// SOURCING: none. Durable catalog behavior over the object contract.

import { describe, expect, it } from 'vitest';
import type {
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  Result,
} from '@commonplace/block-view/types';
import {
  DurableChatCatalog,
  type ChatCatalogObjectSeam,
} from './catalog-repository';

class InMemoryObjectSeam implements ChatCatalogObjectSeam {
  readonly objects = new Map<string, ObjectRef>();

  async query(query: ObjectQuery): Promise<ObjectSet> {
    const matching = [...this.objects.values()].filter((object) => (
      query.types.includes(object.type)
      && (
        query.where?.kind !== 'eq'
        || query.where.field !== 'id'
        || object.id === query.where.value
      )
    ));
    const offset = Number(query.page?.cursor ?? 0);
    const end = query.page ? offset + query.page.limit : matching.length;
    const objects = matching.slice(offset, end);
    return {
      objects,
      shape: {
        types: [...query.types],
        fields: [],
        relations: [],
        axes: {},
        cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
      },
      next_cursor: end < matching.length ? String(end) : undefined,
      subscribe: () => () => {},
    };
  }

  async emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    if (action.kind === 'create') {
      const id = typeof action.props.id === 'string' ? action.props.id : `object-${this.objects.size}`;
      this.objects.set(id, {
        id,
        type: action.type,
        properties: { ...action.props, id },
      });
    } else if (action.kind === 'update') {
      const current = this.objects.get(action.id);
      if (!current) return { ok: false, error: `missing: ${action.id}` };
      this.objects.set(action.id, {
        ...current,
        properties: { ...current.properties, ...action.patch },
      });
    }
    return {
      ok: true,
      value: {
        action_kind: action.kind,
        status: 'applied',
        target_ids: action.kind === 'create'
          ? [String(action.props.id)]
          : 'id' in action
            ? [action.id]
            : [],
      },
    };
  }
}

describe('DurableChatCatalog', () => {
  it('seeds its catalog and preserves the public API shape', async () => {
    const seam = new InMemoryObjectSeam();
    const repository = new DurableChatCatalog(seam, () => 'project-id', () => 10);

    const catalog = await repository.readCatalog();

    expect(catalog.activeProjectId).toBe('chat-project:default');
    expect(catalog.projects).toEqual([{
      id: 'chat-project:default',
      name: 'Default project',
      description: '',
      documentIds: [],
      objectTypes: ['person', 'task', 'project', 'org', 'doc', 'record'],
      updatedAt: 10,
    }]);
    expect(catalog.threads).toEqual([]);
    expect([...seam.objects.values()].map((object) => object.type).sort()).toEqual([
      'chat-catalog',
      'chat-project',
    ]);
  });

  it('restores a stable thread id and transcript through a fresh repository', async () => {
    const seam = new InMemoryObjectSeam();
    let now = 100;
    const first = new DurableChatCatalog(seam, () => 'stable-id', () => now++);
    const initial = await first.readCatalog();
    const created = await first.createThread({
      projectId: initial.activeProjectId ?? undefined,
      title: 'Durable transcript',
    });
    await first.updateThread(created.id, {
      sessionId: 'runtime-session-hint',
      messages: [
        { id: 'message-1', role: 'user', text: 'Persist this' },
        { id: 'message-2', role: 'assistant', text: 'Persisted' },
      ],
    });

    const afterRedeploy = new DurableChatCatalog(seam, () => 'unused', () => 999);
    const restored = await afterRedeploy.getThread(created.id);
    const catalog = await afterRedeploy.readCatalog();

    expect(created.id).toBe('chat-thread:stable-id');
    expect(restored).toMatchObject({
      id: 'chat-thread:stable-id',
      title: 'Durable transcript',
      sessionId: 'runtime-session-hint',
      sessionResumable: false,
      messages: [
        { id: 'message-1', role: 'user', text: 'Persist this' },
        { id: 'message-2', role: 'assistant', text: 'Persisted' },
      ],
    });
    expect(catalog.threads.map((thread) => thread.id)).toEqual(['chat-thread:stable-id']);
  });

  it('persists project selection and project updates', async () => {
    const seam = new InMemoryObjectSeam();
    const repository = new DurableChatCatalog(seam, () => 'research', () => 20);
    await repository.readCatalog();
    const project = await repository.upsertProject({ name: 'Research' });
    await repository.setActiveProject(project.id);

    const afterRedeploy = new DurableChatCatalog(seam);
    const restored = await afterRedeploy.readCatalog();

    expect(restored.activeProjectId).toBe('chat-project:research');
    expect(restored.projects.find((candidate) => candidate.id === project.id)?.name).toBe('Research');
  });

  it('rejects a transport-successful action that was not applied', async () => {
    class AcceptedObjectSeam extends InMemoryObjectSeam {
      override async emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
        return {
          ok: true,
          value: {
            action_kind: action.kind,
            status: 'accepted',
            target_ids: [],
          },
        };
      }
    }

    const repository = new DurableChatCatalog(new AcceptedObjectSeam());

    await expect(repository.readCatalog()).rejects.toThrow(
      'chat catalog object action was not applied: accepted',
    );
  });
});
