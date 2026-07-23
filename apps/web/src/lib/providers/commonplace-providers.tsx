'use client';

import type { ReactNode } from 'react';
import { LayoutProvider } from './layout-provider';
import { WorkspaceProvider } from './workspace-provider';
import { CaptureProvider, useCapture } from './capture-provider';
import { DrawerProvider } from './drawer-provider';
import { SelectionProvider } from './selection-provider';

/**
 * Inner wrapper that wires SelectionProvider's onCaptured
 * to CaptureProvider's notifyCaptured. Needs to be a separate
 * component so useCapture() is called within CaptureProvider's tree.
 */
function SelectionWithCaptureBridge({ children }: { children: ReactNode }) {
  const { notifyCaptured } = useCapture();
  return (
    <SelectionProvider onCaptured={notifyCaptured}>
      {children}
    </SelectionProvider>
  );
}

/**
 * Nested provider tree for CommonPlace (legacy apps/web).
 *
 * Nesting order (outer = stable, inner = volatile):
 *   Layout > Workspace > Capture > Drawer > Selection
 *
 * CommonplaceHost lives on apps/console (canonical React host surface).
 */
export function CommonPlaceProviders({ children }: { children: ReactNode }) {
  return (
    <LayoutProvider>
      <WorkspaceProvider>
        <CaptureProvider>
          <DrawerProvider>
            <SelectionWithCaptureBridge>
              {children}
            </SelectionWithCaptureBridge>
          </DrawerProvider>
        </CaptureProvider>
      </WorkspaceProvider>
    </LayoutProvider>
  );
}
