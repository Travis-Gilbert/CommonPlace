export const SCENE_PACKAGE_SCHEMA_VERSION = 'scene-package-v2';
export const RENDER_SCENE_PAYLOAD_TYPE = 'scene_package';

export type CoordinateSpace =
  | 'graph'
  | 'geo'
  | 'timeline'
  | 'rank'
  | 'matrix'
  | 'diagram'
  | 'frame'
  | 'gallery'
  | 'freeform';

export type AtomLifecycle = 'entering' | 'present' | 'leaving' | 'terminal';
export type RendererFamily = 'scene' | 'object';
export type PatchSupport = 'none' | 'replace' | 'incremental';

export interface ProjectionBinding {
  id: string;
  params?: Record<string, unknown>;
}

export interface ChromeBinding {
  id: string;
  params?: Record<string, unknown>;
}

export interface AtomPosition {
  x: number;
  y: number;
  z?: number;
  space?: CoordinateSpace;
}

export interface SourceRef {
  kind: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface SceneAtom {
  id: string;
  kind?: string;
  label?: string;
  position?: AtomPosition;
  weight?: number;
  color?: string;
  opacity?: number;
  glyph?: string;
  scale?: number;
  lifecycle?: AtomLifecycle;
  metadata?: Record<string, unknown>;
  sourceRefs?: SourceRef[];
}

export interface SceneRelation {
  id: string;
  sourceId: string;
  targetId: string;
  kind?: string;
  weight?: number;
  color?: string;
  opacity?: number;
  glyph?: string;
  lifecycle?: AtomLifecycle;
  metadata?: Record<string, unknown>;
  sourceRefs?: SourceRef[];
}

export interface ActionDescriptor {
  id: string;
  label: string;
  actionType: string;
  interaction: string;
  target?: string;
  payload?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  proposalOnly?: boolean;
}

export interface TransitionDescriptor {
  from?: string;
  choreography: string;
}

export interface TerminalStateArtifact {
  svg?: string;
  json?: Record<string, unknown>;
  sourceRefs?: Array<Record<string, unknown>>;
}

export interface ScenePackageV2 {
  schema_version: typeof SCENE_PACKAGE_SCHEMA_VERSION | string;
  version: typeof SCENE_PACKAGE_SCHEMA_VERSION | string;
  id: string;
  manifestRef: string;
  atoms: SceneAtom[];
  relations: SceneRelation[];
  projection: ProjectionBinding;
  chrome: ChromeBinding;
  actions?: ActionDescriptor[];
  transitions?: TransitionDescriptor;
  terminalState?: TerminalStateArtifact;
  provenance?: Record<string, unknown>;
}

export interface RendererBudgets {
  maxAtoms: number;
  maxRelations: number;
  maxPayloadBytes: number;
  maxTableRows?: number;
  maxMarks?: number;
}

export interface RendererCapability {
  id: string;
  label: string;
  rendererFamily: RendererFamily;
  supported?: boolean;
  requires?: string[];
  coordinateSpaces?: CoordinateSpace[];
  objectKinds?: string[];
  interactions?: string[];
  patchSupport?: PatchSupport;
  budgets: RendererBudgets;
  fallbackRenderer?: string;
}

export interface SceneValidation {
  ok: boolean;
  reason?: string;
}

export interface RenderScenePayload {
  type: typeof RENDER_SCENE_PAYLOAD_TYPE | string;
  tool: 'render_scene' | string;
  scene_package: ScenePackageV2 | null;
  fallback_summary: string;
  validation: SceneValidation;
}

export type RendererCatalog = Record<string, RendererCapability>;

export const DEFAULT_RENDERER_CAPABILITIES: RendererCatalog = {
  evidence_board: sceneCapability(
    'evidence_board',
    'Evidence board',
    ['freeform'],
    { maxAtoms: 200, maxRelations: 400, maxPayloadBytes: 262_144 },
    undefined,
    ['inspect', 'select'],
  ),
  graph_neighborhood: {
    ...sceneCapability(
      'graph_neighborhood',
      'Graph neighborhood',
      ['graph'],
      { maxAtoms: 500, maxRelations: 1_000, maxPayloadBytes: 524_288 },
      'evidence_board',
      ['inspect', 'select', 'pan', 'zoom'],
    ),
    requires: ['webgl'],
  },
  table: sceneCapability(
    'table',
    'Table',
    ['matrix'],
    { maxAtoms: 2_000, maxRelations: 2_000, maxPayloadBytes: 524_288, maxTableRows: 2_000 },
    'evidence_board',
    ['inspect', 'sort'],
  ),
  chart: sceneCapability(
    'chart',
    'Chart',
    ['frame'],
    { maxAtoms: 5_000, maxRelations: 0, maxPayloadBytes: 524_288, maxMarks: 1 },
    'evidence_board',
    ['inspect'],
  ),
  mechanism_diagram: sceneCapability(
    'mechanism_diagram',
    'Mechanism diagram',
    ['diagram'],
    { maxAtoms: 300, maxRelations: 600, maxPayloadBytes: 524_288 },
    'evidence_board',
    ['inspect', 'select'],
  ),
  patent_diagram: sceneCapability(
    'patent_diagram',
    'Patent diagram',
    ['diagram'],
    { maxAtoms: 300, maxRelations: 600, maxPayloadBytes: 524_288 },
    'evidence_board',
    ['inspect', 'select', 'expand'],
  ),
  'object.task': objectCapability('object.task', 'Task object', 'task'),
  'object.file': objectCapability('object.file', 'File object', 'file'),
  'object.link': objectCapability('object.link', 'Link object', 'link'),
  'object.note': objectCapability('object.note', 'Note object', 'note'),
  'object.claim': objectCapability('object.claim', 'Claim object', 'claim'),
  'object.source': objectCapability('object.source', 'Source object', 'source'),
  model_3d: {
    ...sceneCapability(
      'model_3d',
      '3D model',
      ['freeform'],
      { maxAtoms: 1, maxRelations: 0, maxPayloadBytes: 262_144 },
      'evidence_board',
      ['inspect', 'pan', 'zoom', 'rotate'],
    ),
    requires: ['webgl'],
  },
};

export function validateScenePackage(
  scenePackage: ScenePackageV2,
  catalog: RendererCatalog = DEFAULT_RENDERER_CAPABILITIES,
): SceneValidation {
  const reason = validateScenePackageReason(scenePackage, catalog);
  return reason ? { ok: false, reason } : { ok: true };
}

export function scenePackagePayloadBytes(scenePackage: ScenePackageV2): number {
  return new TextEncoder().encode(JSON.stringify(scenePackage)).length;
}

export function isRenderScenePayload(value: unknown): value is RenderScenePayload {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RenderScenePayload>;
  return record.type === RENDER_SCENE_PAYLOAD_TYPE && record.tool === 'render_scene';
}

export function isScenePackageV2(value: unknown): value is ScenePackageV2 {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ScenePackageV2>;
  return (
    record.schema_version === SCENE_PACKAGE_SCHEMA_VERSION &&
    record.version === SCENE_PACKAGE_SCHEMA_VERSION &&
    typeof record.id === 'string' &&
    typeof record.manifestRef === 'string' &&
    Array.isArray(record.atoms) &&
    Array.isArray(record.relations) &&
    !!record.projection &&
    typeof record.projection.id === 'string' &&
    !!record.chrome &&
    typeof record.chrome.id === 'string'
  );
}

function validateScenePackageReason(
  scenePackage: ScenePackageV2,
  catalog: RendererCatalog,
): string | undefined {
  if (scenePackage.schema_version !== SCENE_PACKAGE_SCHEMA_VERSION) {
    return `unsupported schema_version: ${scenePackage.schema_version}`;
  }
  if (scenePackage.version !== SCENE_PACKAGE_SCHEMA_VERSION) {
    return `unsupported version: ${scenePackage.version}`;
  }
  const rendererId = scenePackage.projection.id;
  if (!rendererId.trim()) return 'missing renderer id';

  const capability = catalog[rendererId];
  if (!capability) return `unknown renderer: ${rendererId}`;
  if (capability.supported === false) return `unsupported renderer: ${rendererId}`;
  if (capability.rendererFamily !== 'scene') return `renderer ${rendererId} is not a scene renderer`;

  if (scenePackage.atoms.length > capability.budgets.maxAtoms) {
    return `renderer ${rendererId} budget exceeded: atoms ${scenePackage.atoms.length} > ${capability.budgets.maxAtoms}`;
  }
  if (scenePackage.relations.length > capability.budgets.maxRelations) {
    return `renderer ${rendererId} budget exceeded: relations ${scenePackage.relations.length} > ${capability.budgets.maxRelations}`;
  }
  const payloadBytes = scenePackagePayloadBytes(scenePackage);
  if (payloadBytes > capability.budgets.maxPayloadBytes) {
    return `renderer ${rendererId} budget exceeded: payload_bytes ${payloadBytes} > ${capability.budgets.maxPayloadBytes}`;
  }

  const atomIds = new Set<string>();
  for (const atom of scenePackage.atoms) {
    if (atomIds.has(atom.id)) return `duplicate atom id: ${atom.id}`;
    atomIds.add(atom.id);
  }
  for (const relation of scenePackage.relations) {
    if (!atomIds.has(relation.sourceId)) {
      return `relation ${relation.id} references missing atom ${relation.sourceId}`;
    }
    if (!atomIds.has(relation.targetId)) {
      return `relation ${relation.id} references missing atom ${relation.targetId}`;
    }
  }
  return undefined;
}

function sceneCapability(
  id: string,
  label: string,
  coordinateSpaces: CoordinateSpace[],
  budgets: RendererBudgets,
  fallbackRenderer: string | undefined,
  interactions: string[],
): RendererCapability {
  return {
    id,
    label,
    rendererFamily: 'scene',
    supported: true,
    requires: [],
    coordinateSpaces,
    objectKinds: [],
    interactions,
    patchSupport: 'replace',
    budgets,
    fallbackRenderer,
  };
}

function objectCapability(id: string, label: string, kind: string): RendererCapability {
  return {
    id,
    label,
    rendererFamily: 'object',
    supported: true,
    requires: [],
    coordinateSpaces: ['freeform'],
    objectKinds: [kind],
    interactions: ['inspect'],
    patchSupport: 'replace',
    budgets: { maxAtoms: 1, maxRelations: 0, maxPayloadBytes: 16_384 },
  };
}
