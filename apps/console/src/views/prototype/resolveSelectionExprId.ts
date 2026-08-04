// SOURCING: none. Pure selection identity helper for prototype.stage.
// SPEC-THEOREM-PROTOTYPE-PIPELINE-1.0 C1: View posts require an explicit expr_id.

/**
 * One entity item from `@rerun-io/web-viewer` `selection_change`.
 * The public event guarantees `entity_path` for entity items; custom
 * `TheoremExprRef` / `expr_id` are optional extras when a future viewer
 * surface exposes them.
 */
export type ViewerSelectionItem = {
  readonly type: string;
  readonly entity_path?: string;
  readonly expr_id?: string;
};

export type ViewerSelectionChange = {
  readonly items: readonly ViewerSelectionItem[];
};

/**
 * Decide which entity item becomes the View selection when the viewer
 * reports zero, one, or many selected entities.
 *
 * v1 product choice: first entity in the event wins. Non-entity items are
 * skipped. Empty entity lists return null (no post).
 */
export function pickPrimaryEntitySelection(
  event: ViewerSelectionChange,
): ViewerSelectionItem | null {
  const entities = event.items.filter(
    (item) => item.type === 'entity' && typeof item.entity_path === 'string',
  );
  return entities[0] ?? null;
}

/**
 * Resolve the explicit expr_id that Theorem's View node requires.
 *
 * Order:
 * 1. Payload `expr_id` when the viewer supplies it (preferred).
 * 2. Load-time `path_to_expr[entity_path]` used only to *fill* the field
 *    before posting — never as a Theorem-side fallback.
 */
export function resolveSelectionExprId(
  item: ViewerSelectionItem,
  pathToExpr: Readonly<Record<string, string>>,
): string | null {
  const fromPayload = item.expr_id?.trim();
  if (fromPayload) return fromPayload;
  const path = item.entity_path?.trim();
  if (!path) return null;
  const fromMap = pathToExpr[path]?.trim();
  return fromMap || null;
}

export function buildExplicitViewSelection(
  item: ViewerSelectionItem,
  pathToExpr: Readonly<Record<string, string>>,
): { entity_path: string; expr_id: string; part_name?: string } | null {
  const entityPath = item.entity_path?.trim();
  if (!entityPath) return null;
  const exprId = resolveSelectionExprId(item, pathToExpr);
  if (!exprId) return null;
  const partName = entityPath.split('/').filter(Boolean).at(-1);
  return {
    entity_path: entityPath,
    expr_id: exprId,
    ...(partName ? { part_name: partName } : {}),
  };
}
