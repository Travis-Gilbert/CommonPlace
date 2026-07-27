import type { BlockHost, JsonValue } from '@commonplace/block-view/types';
import { CONSOLE_DATA_SURFACE_ID } from '@/lib/workspace-seed';

export const CONSOLE_DATA_REGION_ID = 'console-data.region-editor';
export const CONSOLE_DATA_VIEW_ID = 'console-data.vi-pane';

interface SurfaceHost extends BlockHost {
  activateSurface(surfaceId: string): Promise<boolean>;
}

function supportsSurfaceActivation(host: BlockHost): host is SurfaceHost {
  return (
    'activateSurface' in host &&
    typeof (host as Partial<SurfaceHost>).activateSurface === 'function'
  );
}

export async function activateConsoleDataSurface(host: BlockHost): Promise<boolean> {
  if (!supportsSurfaceActivation(host) || !(await mountConsoleDataSurface(host))) return false;
  return host.activateSurface(CONSOLE_DATA_SURFACE_ID);
}

export async function activateFallbackSurface(
  host: BlockHost,
  surfaceId: string,
): Promise<boolean> {
  return supportsSurfaceActivation(host) ? host.activateSurface(surfaceId) : false;
}

export async function mountConsoleDataSurface(host: BlockHost): Promise<boolean> {
  const layout = await host.query({ types: ['surface', 'region', 'view-instance'] });
  const ids = new Set(layout.objects.map((object) => object.id));
  const create = async (
    id: string,
    type: 'surface' | 'region' | 'view-instance',
    props: Record<string, JsonValue>,
  ): Promise<boolean> => {
    if (ids.has(id)) return true;
    const result = await host.emit({
      kind: 'create',
      type,
      props: { id, ...props },
    });
    if (result.ok) ids.add(id);
    return result.ok;
  };

  if (
    !(await create(CONSOLE_DATA_SURFACE_ID, 'surface', {
      name: 'Your data',
      kind: 'data',
      role: 'surface',
      active: false,
      plugin_id: 'commonplace.console',
      seed_revision: 2,
    })) ||
    !(await create(CONSOLE_DATA_REGION_ID, 'region', {
      kind: 'editor',
      size: 100,
      active_tab: CONSOLE_DATA_VIEW_ID,
      plugin_id: 'commonplace.console',
      seed_revision: 2,
    })) ||
    !(await create(CONSOLE_DATA_VIEW_ID, 'view-instance', {
      descriptor_id: 'commonplace.console',
      title: 'Your data',
      query: { types: ['surface'] },
      plugin_id: 'commonplace.console',
      seed_revision: 2,
    }))
  ) {
    return false;
  }

  const regionMove = await host.emit({
    kind: 'move',
    id: CONSOLE_DATA_REGION_ID,
    new_parent: CONSOLE_DATA_SURFACE_ID,
    order: 0,
  });
  const viewMove = await host.emit({
    kind: 'move',
    id: CONSOLE_DATA_VIEW_ID,
    new_parent: CONSOLE_DATA_REGION_ID,
    order: 0,
  });
  return regionMove.ok && viewMove.ok;
}

export async function unmountConsoleDataSurface(host: BlockHost): Promise<boolean> {
  for (const id of [CONSOLE_DATA_VIEW_ID, CONSOLE_DATA_REGION_ID, CONSOLE_DATA_SURFACE_ID]) {
    const result = await host.emit({ kind: 'delete', id });
    if (!result.ok) return false;
  }
  return true;
}
