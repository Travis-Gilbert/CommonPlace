// SOURCING: none. Pure logic, no upstream component applies.
/**
 * Descriptor registry mechanics, extracted from
 * apps/web/src/lib/work-surface/view-registry.tsx with the web components
 * removed (the package carries zero components by contract). A registry is
 * an ordered list of ViewDescriptors; shape narrowing goes through the
 * documented ObjectShapeMatch interpreter in shape-match.ts. Apps register
 * their own descriptors (renderer components stay app-side) and resolve
 * them here.
 */

import type { MountPoint, ObjectShape, ViewDescriptor } from './types';
import { matchesShape } from './shape-match';

export interface ViewRegistry {
  /** All registered descriptors, in registration (switcher) order. */
  readonly descriptors: readonly ViewDescriptor[];
  /** Descriptors whose `accepts` clause matches the given shape, in order. */
  matchingViews(shape: ObjectShape): readonly ViewDescriptor[];
  /** Look up a registered descriptor by id. */
  viewById(id: string): ViewDescriptor | undefined;
  /** Descriptors that declare `block` and list the given mount point. */
  blocksForMount(mount: MountPoint): readonly ViewDescriptor[];
  /** Register a descriptor; last registration wins on id collision. */
  register(descriptor: ViewDescriptor): void;
}

export function createViewRegistry(initial: readonly ViewDescriptor[] = []): ViewRegistry {
  const descriptors: ViewDescriptor[] = [...initial];
  return {
    get descriptors() {
      return descriptors as readonly ViewDescriptor[];
    },
    matchingViews(shape: ObjectShape): readonly ViewDescriptor[] {
      return descriptors.filter((view) => matchesShape(view.accepts, shape));
    },
    viewById(id: string): ViewDescriptor | undefined {
      return descriptors.find((view) => view.id === id);
    },
    blocksForMount(mount: MountPoint): readonly ViewDescriptor[] {
      return descriptors.filter((view) => view.block?.mounts.includes(mount) ?? false);
    },
    register(descriptor: ViewDescriptor): void {
      const existing = descriptors.findIndex((view) => view.id === descriptor.id);
      if (existing >= 0) descriptors[existing] = descriptor;
      else descriptors.push(descriptor);
    },
  };
}
