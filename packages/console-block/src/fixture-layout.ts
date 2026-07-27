import type { NodePosition } from './types';

export const CONSOLE_LAYOUT_SEED = 0x434f4e534f4c4531n;
export const CONSOLE_LAYOUT_FINGERPRINT = 10496215397300334112n;

export const FIXTURE_NODE_POSITIONS: readonly NodePosition[] = [
  {
    id: 'node:ada',
    x: -41.12006321030561,
    y: -42.34738695414882,
    vx: 0.004444121892450178,
    vy: 0.0006076847114271633,
    pinned: false,
  },
  {
    id: 'node:atlas',
    x: -44.21624679250018,
    y: 41.186832277628746,
    vx: 0.017794557057857437,
    vy: 0.0010572270994432433,
    pinned: false,
  },
  {
    id: 'node:console-note',
    x: 39.21246095010106,
    y: 39.57841812093473,
    vx: 0.018077216286373505,
    vy: 0.014920438901655265,
    pinned: false,
  },
  {
    id: 'node:standing-people',
    x: 42.177369201635756,
    y: -41.1034896033952,
    vx: 0.0041430905649819825,
    vy: 0.01366951432583222,
    pinned: false,
  },
] as const;

function deterministicPosition(
  nodeId: string,
  orderedNodeIds: readonly string[],
): readonly [number, number] {
  const index = orderedNodeIds.indexOf(nodeId);
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  const radius = 48 * Math.sqrt(index + 1);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export function orderedPositionArray(nodeIds: readonly string[]): Float32Array {
  const positions = new Map(FIXTURE_NODE_POSITIONS.map((position) => [position.id, position]));
  const orderedNodeIds = [...new Set(nodeIds)].sort();
  return new Float32Array(
    nodeIds.flatMap((nodeId) => {
      const position = positions.get(nodeId);
      return position
        ? [position.x, position.y]
        : deterministicPosition(nodeId, orderedNodeIds);
    }),
  );
}
