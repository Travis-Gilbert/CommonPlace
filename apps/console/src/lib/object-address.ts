// SOURCING: @commonplace/block-view/addressing (the shared theorem:// helper
// DESIGN-THEOREM-URI names; the same module mobile binds to). Nothing here
// re-implements emit or parse. What this file adds is the console's one
// mapping: a graph object's `type` is the address `kind`, and the tenant is
// read from the shell store by the caller, so no surface mints a second copy
// of the tenant slug.

import { theoremUri } from '@commonplace/block-view/addressing';

/** The object shape every console surface already holds: an ObjectRef, a
 *  staged chip target, or a mention item. Only identity is needed to address
 *  it, because identity lives in the id and `kind` is routing sugar. */
export interface AddressableObject {
  readonly id: string;
  readonly type: string;
}

/** The canonical address of an object in a tenant. */
export function objectAddress(tenant: string, object: AddressableObject): string {
  return theoremUri({ tenant, kind: object.type, id: object.id });
}

/** The same address from loose parts, for call sites that hold an id and a
 *  kind but no object (a chip helper, a paste handler). */
export function addressOf(tenant: string, kind: string, id: string): string {
  return theoremUri({ tenant, kind, id });
}
