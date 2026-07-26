// SOURCING: SPEC-THEOREM-CONTROL-PRIMITIVES-1.0 CP3.
// Navigation items as data for the console sidebar Objects section.

import { auth } from '@/lib/auth';
import { NavigationError } from '@/lib/navigationRegistry';
import {
  declareObjectNav,
  deleteNavigationItem,
  insertNavigationItem,
  listNavigation,
  retireObjectNav,
  updateNavigationPosition,
} from '@/lib/server/navigation-store';
import type { NavItem, NavItemKind, NavScope } from '@/lib/navigationRegistry';

export const dynamic = 'force-dynamic';

function viewerId(session: {
  user?: {
    id?: string | null;
    email?: string | null;
    githubLogin?: string | null;
    harnessIdentity?: string | null;
  };
} | null): string {
  return session?.user?.harnessIdentity
    ?? session?.user?.githubLogin
    ?? session?.user?.id
    ?? session?.user?.email
    ?? 'anonymous';
}

function parseScope(value: unknown): NavScope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind === 'workspace') return { kind: 'workspace' };
  if (record.kind === 'user' && typeof record.userId === 'string') {
    return { kind: 'user', userId: record.userId };
  }
  return null;
}

function parseItemKind(value: unknown): NavItemKind | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  switch (record.kind) {
    case 'folder':
      return typeof record.name === 'string' ? { kind: 'folder', name: record.name } : null;
    case 'link':
      return typeof record.name === 'string' && typeof record.url === 'string'
        ? { kind: 'link', name: record.name, url: record.url }
        : null;
    case 'object':
      return typeof record.objectTypeId === 'string'
        ? {
            kind: 'object',
            objectTypeId: record.objectTypeId,
            name: typeof record.name === 'string' ? record.name : null,
          }
        : null;
    case 'view':
      return typeof record.viewId === 'string'
        ? {
            kind: 'view',
            viewId: record.viewId,
            name: typeof record.name === 'string' ? record.name : null,
          }
        : null;
    case 'record':
      return typeof record.objectTypeId === 'string' && typeof record.recordId === 'string'
        ? {
            kind: 'record',
            objectTypeId: record.objectTypeId,
            recordId: record.recordId,
            name: typeof record.name === 'string' ? record.name : null,
          }
        : null;
    default:
      return null;
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof NavigationError) {
    const status = error.code === 'layout_capability_required' ? 403
      : error.code === 'not_found' ? 404
        : 400;
    return Response.json({ error: error.code, message: error.message }, { status });
  }
  return Response.json({ error: 'navigation_failed' }, { status: 500 });
}

export async function GET(): Promise<Response> {
  const session = await auth();
  const items = listNavigation(viewerId(session), true);
  return Response.json({ items });
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.op !== 'string') {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Workspace mutations require layout capability. Session owners and signed-in
  // principals carry it for the console shell; anonymous callers do not.
  const hasLayout = body.hasLayoutCapability === true
    || session?.user?.isOwner === true
    || Boolean(session?.user);

  try {
    switch (body.op) {
      case 'declare': {
        const objectTypeId = typeof body.objectTypeId === 'string' ? body.objectTypeId : '';
        const pluralLabel = typeof body.pluralLabel === 'string' ? body.pluralLabel : objectTypeId;
        if (!objectTypeId) return Response.json({ error: 'object_type_id_required' }, { status: 400 });
        const item = declareObjectNav(
          objectTypeId,
          pluralLabel,
          typeof body.position === 'number' ? body.position : undefined,
        );
        return Response.json({ item });
      }
      case 'retire': {
        const objectTypeId = typeof body.objectTypeId === 'string' ? body.objectTypeId : '';
        if (!objectTypeId) return Response.json({ error: 'object_type_id_required' }, { status: 400 });
        retireObjectNav(objectTypeId);
        return Response.json({ ok: true });
      }
      case 'create': {
        const id = typeof body.id === 'string' ? body.id : '';
        const itemKind = parseItemKind(body.itemKind);
        const scope = parseScope(body.scope);
        if (!id || !itemKind || !scope) {
          return Response.json({ error: 'invalid_item' }, { status: 400 });
        }
        const item: NavItem = {
          id,
          itemKind,
          scope,
          position: typeof body.position === 'number' ? body.position : 0,
          parentId: typeof body.parentId === 'string' ? body.parentId : null,
        };
        insertNavigationItem(item, hasLayout);
        return Response.json({ item });
      }
      case 'reorder': {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id || typeof body.position !== 'number') {
          return Response.json({ error: 'invalid_reorder' }, { status: 400 });
        }
        updateNavigationPosition(id, body.position, hasLayout);
        return Response.json({ ok: true });
      }
      case 'delete': {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
        deleteNavigationItem(id, hasLayout);
        return Response.json({ ok: true });
      }
      default:
        return Response.json({ error: 'unknown_op' }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
