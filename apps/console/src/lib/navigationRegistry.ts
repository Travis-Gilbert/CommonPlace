// SOURCING: SPEC-THEOREM-CONTROL-PRIMITIVES-1.0 CP3.
// Navigation items as data, scoped to user or workspace. Declaring an object
// type creates a workspace Object item; retiring removes it.

export type NavItemKind =
  | { readonly kind: 'folder'; readonly name: string }
  | { readonly kind: 'link'; readonly name: string; readonly url: string }
  | { readonly kind: 'object'; readonly objectTypeId: string; readonly name?: string | null }
  | { readonly kind: 'view'; readonly viewId: string; readonly name?: string | null }
  | { readonly kind: 'record'; readonly objectTypeId: string; readonly recordId: string; readonly name?: string | null };

export type NavScope =
  | { readonly kind: 'user'; readonly userId: string }
  | { readonly kind: 'workspace' };

export interface NavItem {
  readonly id: string;
  readonly itemKind: NavItemKind;
  readonly scope: NavScope;
  readonly position: number;
  readonly parentId?: string | null;
}

export type NavigationErrorCode =
  | 'layout_capability_required'
  | 'not_found'
  | 'immutable_kind';

export class NavigationError extends Error {
  readonly code: NavigationErrorCode;

  constructor(code: NavigationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'NavigationError';
  }
}

export function navObjectId(objectTypeId: string): string {
  return `nav.object.${objectTypeId}`;
}

export function deriveLabel(
  itemKind: NavItemKind,
  typePlural?: string | null,
  viewName?: string | null,
  recordIdentifier?: string | null,
): string {
  switch (itemKind.kind) {
    case 'folder':
    case 'link':
      return itemKind.name;
    case 'object':
      return itemKind.name ?? typePlural ?? `${itemKind.objectTypeId}s`;
    case 'view':
      return itemKind.name ?? viewName ?? itemKind.viewId;
    case 'record':
      return itemKind.name ?? recordIdentifier ?? itemKind.recordId;
  }
}

export class NavigationRegistry {
  private items: NavItem[] = [];

  listFor(viewerUserId: string, includeWorkspace: boolean): NavItem[] {
    return this.items
      .filter((item) => {
        if (item.scope.kind === 'workspace') return includeWorkspace;
        return item.scope.userId === viewerUserId;
      })
      .slice()
      .sort((a, b) => a.position - b.position);
  }

  insert(item: NavItem, hasLayoutCapability: boolean): void {
    if (item.scope.kind === 'workspace' && !hasLayoutCapability) {
      throw new NavigationError('layout_capability_required', 'layout capability required for workspace scope');
    }
    this.items = this.items.filter((existing) => existing.id !== item.id);
    this.items.push(item);
  }

  updatePosition(id: string, position: number, hasLayoutCapability: boolean): void {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) throw new NavigationError('not_found', `unknown navigation item: ${id}`);
    if (item.scope.kind === 'workspace' && !hasLayoutCapability) {
      throw new NavigationError('layout_capability_required', 'layout capability required for workspace scope');
    }
    this.items = this.items.map((candidate) => (
      candidate.id === id ? { ...candidate, position } : candidate
    ));
  }

  delete(id: string, hasLayoutCapability: boolean): void {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) throw new NavigationError('not_found', `unknown navigation item: ${id}`);
    if (item.scope.kind === 'workspace' && !hasLayoutCapability) {
      throw new NavigationError('layout_capability_required', 'layout capability required for workspace scope');
    }
    const remove = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of this.items) {
        if (candidate.parentId && remove.has(candidate.parentId) && !remove.has(candidate.id)) {
          remove.add(candidate.id);
          grew = true;
        }
      }
    }
    this.items = this.items.filter((candidate) => !remove.has(candidate.id));
  }

  /** Generation rule: schema_declare creates a workspace Object item. */
  onSchemaDeclare(objectTypeId: string, pluralLabel: string, position: number): NavItem {
    const item: NavItem = {
      id: navObjectId(objectTypeId),
      itemKind: { kind: 'object', objectTypeId, name: pluralLabel },
      scope: { kind: 'workspace' },
      position,
      parentId: null,
    };
    this.insert(item, true);
    return item;
  }

  /** Generation rule: schema_retire retires the Object item. */
  onSchemaRetire(objectTypeId: string): void {
    this.delete(navObjectId(objectTypeId), true);
  }
}

export function navItemToHostProps(item: NavItem): Record<string, string | number | boolean | null> {
  const base: Record<string, string | number | boolean | null> = {
    id: item.id,
    scope_kind: item.scope.kind,
    scope_user_id: item.scope.kind === 'user' ? item.scope.userId : null,
    position: item.position,
    parent_id: item.parentId ?? null,
    item_kind: item.itemKind.kind,
  };
  switch (item.itemKind.kind) {
    case 'folder':
      return { ...base, name: item.itemKind.name };
    case 'link':
      return { ...base, name: item.itemKind.name, url: item.itemKind.url };
    case 'object':
      return {
        ...base,
        object_type_id: item.itemKind.objectTypeId,
        name: item.itemKind.name ?? null,
      };
    case 'view':
      return {
        ...base,
        view_id: item.itemKind.viewId,
        name: item.itemKind.name ?? null,
      };
    case 'record':
      return {
        ...base,
        object_type_id: item.itemKind.objectTypeId,
        record_id: item.itemKind.recordId,
        name: item.itemKind.name ?? null,
      };
  }
}

export function hostPropsToNavItem(properties: Record<string, unknown>, id: string): NavItem | null {
  const itemKindRaw = properties.item_kind;
  if (typeof itemKindRaw !== 'string') return null;
  const scopeKind = properties.scope_kind === 'user' ? 'user' : 'workspace';
  const scope: NavScope = scopeKind === 'user'
    ? { kind: 'user', userId: String(properties.scope_user_id ?? '') }
    : { kind: 'workspace' };
  const position = typeof properties.position === 'number' ? properties.position : 0;
  const parentId = typeof properties.parent_id === 'string' ? properties.parent_id : null;
  const name = typeof properties.name === 'string' ? properties.name : null;

  let itemKind: NavItemKind;
  switch (itemKindRaw) {
    case 'folder':
      itemKind = { kind: 'folder', name: name ?? id };
      break;
    case 'link':
      itemKind = {
        kind: 'link',
        name: name ?? id,
        url: typeof properties.url === 'string' ? properties.url : '',
      };
      break;
    case 'object':
      itemKind = {
        kind: 'object',
        objectTypeId: String(properties.object_type_id ?? ''),
        name,
      };
      break;
    case 'view':
      itemKind = {
        kind: 'view',
        viewId: String(properties.view_id ?? ''),
        name,
      };
      break;
    case 'record':
      itemKind = {
        kind: 'record',
        objectTypeId: String(properties.object_type_id ?? ''),
        recordId: String(properties.record_id ?? ''),
        name,
      };
      break;
    default:
      return null;
  }

  return { id, itemKind, scope, position, parentId };
}

export const NAV_ITEM_TYPE = 'nav-item' as const;
