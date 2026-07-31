// Object label visibility is pure view state. Persistence belongs to the
// CommonPlace host, not this registry projection package.
export type ObjLabelPart = "source" | "fields" | "status";
export type ObjHidden = Readonly<Record<ObjLabelPart, boolean>>;

export const OBJ_LABEL_PARTS: readonly ObjLabelPart[] = ["source", "fields", "status"];
export const NOTHING_HIDDEN: ObjHidden = { source: false, fields: false, status: false };
export const ALL_HIDDEN: ObjHidden = { source: true, fields: true, status: true };

export function hiddenCount(hidden: ObjHidden): number {
  return OBJ_LABEL_PARTS.filter(part => hidden[part]).length;
}

export function isNothingHidden(hidden: ObjHidden): boolean {
  return hiddenCount(hidden) === 0;
}

export function isAllHidden(hidden: ObjHidden): boolean {
  return hiddenCount(hidden) === OBJ_LABEL_PARTS.length;
}

export function togglePart(hidden: ObjHidden, part: ObjLabelPart): ObjHidden {
  return { ...hidden, [part]: !hidden[part] };
}
