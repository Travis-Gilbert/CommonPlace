'use client';

// SOURCING: @commonplace/canvas-substrate node-kind registry: the program node
// is registered as a kind rather than shipping its own node component, which is
// the property that keeps the substrate shell kind-agnostic (issue 144 A).
//
// ComfyUI's widget/input duality is the model for parameters here: an
// unconnected input *is* a parameter widget, and connecting a wire to it turns
// the widget back into a plain port. That maps onto the run contract with no
// backend change, because `tweaks` is already keyed by node id and holds an
// arbitrary JSON object per node -- a widget write is tweaks[node][port].

import {
  CheckCircledIcon,
  CodeIcon,
  DotFilledIcon,
  ExitIcon,
  EyeOpenIcon,
  LayersIcon,
  LightningBoltIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons';
import type {
  NodeBadge,
  NodeKindEntry,
  NodeStatus,
  SubstratePort,
} from '@commonplace/canvas-substrate';
import { shortNodeBadge } from '@commonplace/canvas-substrate';
import type { FieldType } from '@commonplace/data-model-contracts';
import type {
  CatalogEntry,
  CatalogLifecycle,
  ProcessLiveness,
  ProgramNodeKind as ProgramNodeKindContract,
  ProgramStationFields,
} from '@commonplace/program-contracts';
import { isWidgetizableShape, shapeClassFor } from './shapeHue';

export const PROGRAM_NODE_KIND = 'program-node';

export interface ProgramPortView {
  readonly id: string;
  readonly shape: string;
  /** Catalog display label. Falls back to the port id when absent. */
  readonly label?: string;
}

export interface ProgramNodeData {
  readonly label: string;
  readonly catalogId: string;
  readonly kind: ProgramNodeKindContract['kind'];
  readonly inputs: readonly ProgramPortView[];
  readonly outputs: readonly ProgramPortView[];
  readonly liveness?: ProcessLiveness;
  readonly lifecycle?: CatalogLifecycle;
  readonly pinned?: boolean;
  readonly stale?: boolean;
  readonly eventLabel?: string;
  readonly collapsed?: boolean;
  readonly advancedOpen?: boolean;
  readonly refusal?: string;
  readonly catalog?: CatalogEntry;
  readonly bypassed?: boolean;
  readonly muted?: boolean;
  readonly station?: ProgramStationFields;
  /** Input port ids that already have an incoming edge; these stay ports. */
  readonly connectedInputs?: readonly string[];
  /**
   * Explicit advanced classification, overriding the derived rule. Sourced
   * from the canvas layout document today; a catalog port flag can feed the
   * same field once the contract carries one.
   */
  readonly advancedPorts?: readonly string[];
  /** Current tweak overlay for this node, keyed by port id. */
  readonly tweaks?: Readonly<Record<string, unknown>>;
  readonly onTweakChange?: (portId: string, value: unknown) => void;
  readonly onToggleCollapsed?: () => void;
  readonly onToggleAdvanced?: () => void;
  readonly onToggleFlag?: (flag: 'bypassed' | 'muted') => void;
}

function KindIcon({ kind }: { readonly kind: ProgramNodeKindContract['kind'] }) {
  switch (kind) {
    case 'source':
      return <DotFilledIcon />;
    case 'sentinel':
      return <EyeOpenIcon />;
    case 'rule':
      return <CodeIcon />;
    case 'stochastic':
      return <LightningBoltIcon />;
    case 'verify':
      return <CheckCircledIcon />;
    case 'fold':
      return <LayersIcon />;
    case 'sink':
      return <ExitIcon />;
    case 'human_input':
      return <QuestionMarkCircledIcon />;
  }
}

/**
 * A shape id is not a field type, so this is a deliberate projection for
 * editing only. Only widgetizable shapes reach here (see `isWidgetizableShape`);
 * the structured planes deliberately get no control rather than a JSON textarea
 * standing in for a table. The server's validate_edge stays the authority on
 * what a port accepts; this only decides which control a reader gets.
 */
export function widgetFieldTypeForShape(shape: string): FieldType {
  // Variable bags edit as JSON; anything else widgetizable is a plain value.
  return shape === 'variables_declared_at_init' || shape === 'preserve_or_replace_variables'
    ? { kind: 'json' }
    : { kind: 'text' };
}

function livenessStatus(liveness: ProcessLiveness | undefined): NodeStatus | undefined {
  switch (liveness) {
    case 'running':
      return 'running';
    case 'refused':
      return 'refused';
    case 'failed':
      return 'failed';
    case undefined:
      return undefined;
    default:
      return 'idle';
  }
}

export function stationBadgeFor(station: ProgramStationFields | undefined): NodeBadge | null {
  return station
    ? {
        id: 'station',
        text: `${station.compiled_topology} station (${station.preset_id})`,
        mono: true,
        tone: 'gold',
        title: `Binding preset ${station.preset_id}`,
      }
    : null;
}

function badgesFor(node: ProgramNodeData): NodeBadge[] {
  const badges: NodeBadge[] = [];
  if (node.catalog) {
    badges.push({
      id: 'fit',
      text: node.catalog.fit_state,
      mono: true,
      title: 'Catalog fit state',
    });
  }
  if (node.lifecycle && node.lifecycle !== 'stable') {
    badges.push({
      id: 'lifecycle',
      text: node.lifecycle,
      mono: true,
      tone: node.lifecycle === 'legacy' ? 'warn' : 'gold',
    });
  }
  if (node.pinned) badges.push({ id: 'pinned', text: 'pinned', mono: true, tone: 'gold' });
  if (node.stale) badges.push({ id: 'stale', text: 'stale', mono: true, tone: 'warn' });
  const stationBadge = stationBadgeFor(node.station);
  if (stationBadge) badges.push(stationBadge);
  return badges;
}

/**
 * Ports for the shell.
 *
 * "Has a wire" and "is advanced" are different questions, and the widget
 * duality makes them independent: primary is every connected port plus every
 * input a reader can actually type into, so a node's tuning tail shows at rest
 * the way it does in the pattern this adapts. Advanced holds only unconnected
 * inputs that expect a wire and offer no control, which is the set that reads
 * as clutter when a node is idle.
 *
 * Authority order: an explicit `advancedPorts` override (per node, from the
 * layout document, or from the catalog once a port contract carries the flag)
 * wins over the derived rule, so a node author or a reader can always disagree
 * with it.
 */
function portsFor(node: ProgramNodeData): SubstratePort[] {
  const connected = new Set(node.connectedInputs ?? []);
  const override = node.advancedPorts ? new Set(node.advancedPorts) : null;

  const inputs = node.inputs.map((port): SubstratePort => {
    const isConnected = connected.has(port.id);
    const widgetized = !isConnected && isWidgetizableShape(port.shape) && Boolean(node.onTweakChange);
    const derivedAdvanced = !isConnected && !widgetized;
    return {
      id: port.id,
      side: 'target',
      label: port.label ?? port.id,
      family: shapeClassFor(port.shape),
      section: (override ? override.has(port.id) : derivedAdvanced) ? 'advanced' : 'primary',
      ...(widgetized
        ? {
            widget: {
              fieldType: widgetFieldTypeForShape(port.shape),
              value: node.tweaks?.[port.id],
              onCommit: (next: unknown) => node.onTweakChange?.(port.id, next),
            },
          }
        : {}),
    };
  });
  const outputs = node.outputs.map((port): SubstratePort => ({
    id: port.id,
    side: 'source',
    label: port.label ?? port.id,
    family: shapeClassFor(port.shape),
  }));
  return [...inputs, ...outputs];
}

export const programNodeKind: NodeKindEntry<ProgramNodeData> = {
  id: PROGRAM_NODE_KIND,
  // Programs saved before the substrate name this node type `program`.
  aliases: ['program'],
  palette: 'program',
  shell: (node, context) => ({
    kindId: PROGRAM_NODE_KIND,
    title: node.label,
    icon: <KindIcon kind={node.kind} />,
    idBadge: shortNodeBadge(context.nodeId),
    badges: badgesFor(node),
    ports: portsFor(node),
    flags: { bypassed: node.bypassed, muted: node.muted },
    status: livenessStatus(node.liveness),
    statusLabel: node.liveness ?? node.eventLabel,
    collapsed: node.collapsed,
    advancedOpen: node.advancedOpen,
    width: 220,
    onToggleCollapsed: node.onToggleCollapsed,
    onToggleAdvanced: node.onToggleAdvanced,
    onToggleFlag: (flag) => node.onToggleFlag?.(flag as 'bypassed' | 'muted'),
  }),
};
