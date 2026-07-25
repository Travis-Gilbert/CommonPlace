// SOURCING: SPEC-THEOREM-CONTROL-PRIMITIVES-1.0 CP3.
// Navigation items are data. Object-kind items from the registry feed the
// Collections tier so a declared type appears without a console code change.

export type NavItemKind =
  | { readonly kind: 'folder'; readonly name: string }
  | { readonly kind: 'link'; readonly name: string; readonly url: string }
  | {
      readonly kind: 'object';
      readonly object_type_id: string;
      readonly name?: string;
    }
  | { readonly kind: 'view'; readonly view_id: string; readonly name?: string }
  | {
      readonly kind: 'record';
      readonly object_type_id: string;
      readonly record_id: string;
      readonly name?: string;
    };

export type NavScope =
  | { readonly scope: 'workspace' }
  | { readonly scope: 'user'; readonly user_id: string };

export interface NavRegistryItem {
  readonly nav_item_id: string;
  readonly tenant: string;
  readonly scope: NavScope;
  readonly kind: NavItemKind;
  readonly position: number;
  readonly parent_id?: string;
  readonly derived_label?: string;
  readonly label: string;
}

export interface RegistryCollection {
  readonly tier: 'collection';
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly surfaceId: string;
  /** Glyph key for sidebar icons; object-typed items use records. */
  readonly kindGlyph: string;
  readonly kind: string;
  readonly objectTypeId: string;
  readonly position: number;
}

/** Project Object-kind nav items into collection entries for the sidebar. */
export function collectionsFromNavRegistry(
  items: readonly NavRegistryItem[],
): readonly RegistryCollection[] {
  return items
    .filter((item) => item.kind.kind === 'object')
    .map((item) => {
      const objectTypeId =
        item.kind.kind === 'object' ? item.kind.object_type_id : item.nav_item_id;
      const label =
        item.derived_label ??
        (item.kind.kind === 'object' ? item.kind.name : undefined) ??
        item.label;
      return {
        tier: 'collection' as const,
        id: item.nav_item_id,
        label,
        path: `/records?type=${encodeURIComponent(objectTypeId)}`,
        surfaceId: `console-records-${objectTypeId}`,
        kindGlyph: 'records',
        kind: 'records',
        objectTypeId,
        position: item.position,
      };
    })
    .sort((a, b) => a.position - b.position);
}

/**
 * Parse nav items from host object properties. The MCP navigation registry
 * persists `NavItem` nodes; the console host surfaces them as ordinary objects.
 */
export function navItemsFromObjects(
  objects: readonly {
    readonly id: string;
    readonly type?: string;
    readonly properties: Record<string, unknown>;
  }[],
): NavRegistryItem[] {
  return objects
    .filter((object) => {
      const labels = object.properties.labels;
      if (Array.isArray(labels) && labels.includes('NavItem')) return true;
      return object.type === 'NavItem' || object.properties.kind != null;
    })
    .map((object) => {
      const props = object.properties;
      const kind = (props.kind ?? {}) as NavItemKind;
      const scopeRaw = props.scope as NavScope | { User?: string } | string | undefined;
      let scope: NavScope = { scope: 'workspace' };
      if (scopeRaw && typeof scopeRaw === 'object') {
        if ('scope' in scopeRaw) {
          scope = scopeRaw as NavScope;
        } else if ('User' in scopeRaw && typeof scopeRaw.User === 'string') {
          scope = { scope: 'user', user_id: scopeRaw.User };
        }
      }
      const label =
        (typeof props.derived_label === 'string' && props.derived_label) ||
        (typeof props.label === 'string' && props.label) ||
        object.id;
      return {
        nav_item_id: String(props.nav_item_id ?? object.id),
        tenant: String(props.tenant ?? ''),
        scope,
        kind,
        position: typeof props.position === 'number' ? props.position : 0,
        parent_id: typeof props.parent_id === 'string' ? props.parent_id : undefined,
        derived_label:
          typeof props.derived_label === 'string' ? props.derived_label : undefined,
        label,
      };
    });
}
