// SOURCING: @commonplace/block-view object contract. Project and active-project
// catalog metadata use the same durable seam as chat transcripts.

import type {
  JsonValue,
  ObjectAction,
  ObjectRef,
} from '@commonplace/block-view/types';
import type { ChatProject } from './project-types';

export const CHAT_PROJECT_TYPE = 'chat-project';
export const CHAT_CATALOG_TYPE = 'chat-catalog';
export const DEFAULT_PROJECT_ID = 'chat-project:default';
export const DEFAULT_CATALOG_ID = 'chat-catalog:default';

function strings(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function projectFromObject(object: ObjectRef): ChatProject | null {
  if (object.type !== CHAT_PROJECT_TYPE) return null;
  return {
    id: object.id,
    name: typeof object.properties.name === 'string'
      ? object.properties.name
      : 'Untitled project',
    description: typeof object.properties.description === 'string'
      ? object.properties.description
      : '',
    documentIds: strings(object.properties.documentIds),
    objectTypes: strings(object.properties.objectTypes),
    updatedAt: typeof object.properties.updatedAt === 'number'
      ? object.properties.updatedAt
      : typeof object.properties.updated_at_ms === 'number'
        ? object.properties.updated_at_ms
        : 0,
  };
}

export function projectProperties(
  project: ChatProject,
): Readonly<Record<string, JsonValue>> {
  return {
    id: project.id,
    title: project.name,
    name: project.name,
    description: project.description,
    documentIds: project.documentIds,
    objectTypes: project.objectTypes,
    updatedAt: project.updatedAt,
    persistence_kind: 'chat-project-v1',
  };
}

export function createProjectAction(project: ChatProject): ObjectAction {
  return {
    kind: 'create',
    type: CHAT_PROJECT_TYPE,
    props: projectProperties(project),
  };
}

export function updateProjectAction(project: ChatProject): ObjectAction {
  const { id: _id, ...patch } = projectProperties(project);
  return { kind: 'update', id: project.id, patch };
}

export function catalogCreateAction(activeProjectId: string): ObjectAction {
  return {
    kind: 'create',
    type: CHAT_CATALOG_TYPE,
    props: {
      id: DEFAULT_CATALOG_ID,
      title: 'Chat catalog',
      activeProjectId,
      persistence_kind: 'chat-catalog-v1',
    },
  };
}

export function catalogUpdateAction(activeProjectId: string): ObjectAction {
  return {
    kind: 'update',
    id: DEFAULT_CATALOG_ID,
    patch: { activeProjectId },
  };
}

export function activeProjectIdFromObject(object: ObjectRef): string | null {
  if (object.type !== CHAT_CATALOG_TYPE) return null;
  return typeof object.properties.activeProjectId === 'string'
    ? object.properties.activeProjectId
    : null;
}
