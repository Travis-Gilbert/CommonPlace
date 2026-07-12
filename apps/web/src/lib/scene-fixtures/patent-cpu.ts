// CPU patent-diagram fixture for SPEC-SCENE-OS-WOW (the D3 "how does a CPU work"
// five-minute test seed, PT-033). Shaped exactly like the package that
// scene-os-core/patent.rs emits: `patent-node` atoms, `patent-edge` relations,
// first-class `patent-callout` atoms (numeral label + evidence sourceRefs), and
// `patent-callout-leader` relations. Doubles as the PatentDiagramRenderer golden
// fixture until PT-011 feeds real agent tool results into compile_scene_package.

import {
  SCENE_PACKAGE_SCHEMA_VERSION,
  type RenderScenePayload,
  type SceneAtom,
  type SceneRelation,
  type ScenePackageV2,
  type SourceRef,
} from '@/lib/scene-package';

const FIG = 1;
const nid = (id: string) => `f${FIG}.${id}`;

interface NodeSpec {
  id: string;
  label: string;
}
interface CalloutSpec {
  numeral: string;
  target: string;
  description: string;
  evidence: SourceRef[];
}

const NODES: NodeSpec[] = [
  { id: 'control', label: 'Control Unit' },
  { id: 'alu', label: 'Arithmetic Logic Unit' },
  { id: 'pc', label: 'Program Counter' },
  { id: 'registers', label: 'Register File' },
  { id: 'cache', label: 'L1 Cache' },
  { id: 'bus', label: 'System Bus' },
  { id: 'memory', label: 'Main Memory' },
  { id: 'io', label: 'Input / Output' },
];

const EDGES: Array<[string, string]> = [
  ['control', 'alu'],
  ['control', 'pc'],
  ['alu', 'registers'],
  ['pc', 'registers'],
  ['registers', 'cache'],
  ['cache', 'bus'],
  ['bus', 'memory'],
  ['bus', 'io'],
];

const CALLOUTS: CalloutSpec[] = [
  {
    numeral: '10',
    target: 'control',
    description:
      'Decodes each fetched instruction and sequences the datapath, asserting the control signals that drive every other unit each clock cycle.',
    evidence: [
      { kind: 'source', id: 'patent:us-3821715', label: 'US 3,821,715 - Data-handling system' },
      { kind: 'concept', id: 'concept:instruction-decode', label: 'Instruction decode' },
    ],
  },
  {
    numeral: '12',
    target: 'alu',
    description:
      'Performs the arithmetic and logic operations - add, subtract, compare, and shift - on operands supplied by the register file.',
    evidence: [{ kind: 'concept', id: 'concept:alu', label: 'Arithmetic logic unit' }],
  },
  {
    numeral: '14',
    target: 'pc',
    description:
      'Holds the address of the next instruction to fetch and increments as execution advances, or is reloaded on a branch.',
    evidence: [{ kind: 'concept', id: 'concept:program-counter', label: 'Program counter' }],
  },
  {
    numeral: '16',
    target: 'registers',
    description:
      'A small bank of fast on-die storage holding the operands and results the ALU reads and writes every cycle.',
    evidence: [{ kind: 'concept', id: 'concept:register-file', label: 'Register file' }],
  },
  {
    numeral: '18',
    target: 'cache',
    description:
      'Keeps recently used instructions and data close to the core so the datapath rarely stalls waiting on main memory.',
    evidence: [
      { kind: 'source', id: 'patent:us-4element-cache', label: 'US 4,464,712 - Cache memory' },
      { kind: 'concept', id: 'concept:locality', label: 'Locality of reference' },
    ],
  },
  {
    numeral: '20',
    target: 'bus',
    description:
      'The shared set of wires carrying addresses and data between the core, main memory, and the I/O subsystem.',
    evidence: [{ kind: 'concept', id: 'concept:system-bus', label: 'System bus' }],
  },
  {
    numeral: '22',
    target: 'memory',
    description: 'Stores the program and its working data outside the core, addressed over the system bus.',
    evidence: [{ kind: 'concept', id: 'concept:von-neumann', label: 'Von Neumann architecture' }],
  },
  {
    numeral: '24',
    target: 'io',
    description: 'Bridges the processor to the outside world - storage, network, and peripheral devices.',
    evidence: [{ kind: 'concept', id: 'concept:io-subsystem', label: 'I/O subsystem' }],
  },
];

const nodeAtoms: SceneAtom[] = NODES.map((node) => ({
  id: nid(node.id),
  kind: 'patent-node',
  label: node.label,
  lifecycle: 'present',
  metadata: { figure_number: FIG, dot_node_id: node.id },
}));

const edgeRelations: SceneRelation[] = EDGES.map(([source, target]) => ({
  id: `${nid(source)}->${nid(target)}`,
  sourceId: nid(source),
  targetId: nid(target),
  kind: 'patent-edge',
  lifecycle: 'present',
  metadata: { figure_number: FIG },
}));

const calloutAtoms: SceneAtom[] = CALLOUTS.map((callout) => ({
  id: `f${FIG}.callout.${callout.numeral}`,
  kind: 'patent-callout',
  label: callout.numeral,
  glyph: 'callout',
  lifecycle: 'present',
  metadata: {
    figure_number: FIG,
    callout_id: `callout-${callout.numeral}`,
    numeral: callout.numeral,
    target_node_id: callout.target,
    description: callout.description,
  },
  sourceRefs: callout.evidence,
}));

const leaderRelations: SceneRelation[] = CALLOUTS.map((callout) => ({
  id: `f${FIG}.callout.${callout.numeral}->${nid(callout.target)}`,
  sourceId: `f${FIG}.callout.${callout.numeral}`,
  targetId: nid(callout.target),
  kind: 'patent-callout-leader',
  lifecycle: 'present',
  metadata: { figure_number: FIG },
}));

export const PATENT_CPU_PACKAGE: ScenePackageV2 = {
  schema_version: SCENE_PACKAGE_SCHEMA_VERSION,
  version: SCENE_PACKAGE_SCHEMA_VERSION,
  id: 'scene-patent-cpu',
  manifestRef: 'manifest:scene-patent-cpu',
  atoms: [...nodeAtoms, ...calloutAtoms],
  relations: [...edgeRelations, ...leaderRelations],
  projection: { id: 'patent_diagram', params: {} },
  chrome: { id: 'patent_plate_shell', params: {} },
  provenance: { title: 'How a CPU works', source: 'SPEC-SCENE-OS-WOW demo' },
};

export function patentCpuPayload(): RenderScenePayload {
  return {
    type: 'scene_package',
    tool: 'render_scene',
    scene_package: PATENT_CPU_PACKAGE,
    fallback_summary:
      'A CPU has a control unit (10) that decodes instructions and drives an ALU (12), program counter (14), and register file (16), backed by an L1 cache (18) that talks to main memory (22) and I/O (24) over the system bus (20).',
    validation: { ok: true },
  };
}
