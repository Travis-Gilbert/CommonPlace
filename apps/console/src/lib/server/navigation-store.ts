// SOURCING: SPEC-THEOREM-CONTROL-PRIMITIVES-1.0 CP3.
// Process-local navigation registry for the console API until Theorem MCP
// owns the durable graph nodes.

import {
  NavigationError,
  NavigationRegistry,
  type NavItem,
} from '@/lib/navigationRegistry';

const globalStore = globalThis as typeof globalThis & {
  __cpNavigationRegistry?: NavigationRegistry;
};

function registry(): NavigationRegistry {
  if (!globalStore.__cpNavigationRegistry) {
    globalStore.__cpNavigationRegistry = new NavigationRegistry();
  }
  return globalStore.__cpNavigationRegistry;
}

export function listNavigation(
  viewerUserId: string,
  includeWorkspace = true,
): NavItem[] {
  return registry().listFor(viewerUserId, includeWorkspace);
}

export function declareObjectNav(
  objectTypeId: string,
  pluralLabel: string,
  position?: number,
): NavItem {
  const nextPosition = position ?? registry().listFor('system', true).length;
  return registry().onSchemaDeclare(objectTypeId, pluralLabel, nextPosition);
}

export function retireObjectNav(objectTypeId: string): void {
  try {
    registry().onSchemaRetire(objectTypeId);
  } catch (error) {
    if (error instanceof NavigationError && error.code === 'not_found') return;
    throw error;
  }
}

export function insertNavigationItem(
  item: NavItem,
  hasLayoutCapability: boolean,
): void {
  registry().insert(item, hasLayoutCapability);
}

export function updateNavigationPosition(
  id: string,
  position: number,
  hasLayoutCapability: boolean,
): void {
  registry().updatePosition(id, position, hasLayoutCapability);
}

export function deleteNavigationItem(
  id: string,
  hasLayoutCapability: boolean,
): void {
  registry().delete(id, hasLayoutCapability);
}

export function resetNavigationStoreForTests(): void {
  globalStore.__cpNavigationRegistry = new NavigationRegistry();
}
