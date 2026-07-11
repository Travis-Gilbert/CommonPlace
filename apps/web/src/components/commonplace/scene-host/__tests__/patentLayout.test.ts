import { describe, expect, it } from 'vitest';
import { buildPatentLayout } from '../renderers/patentLayout';
import { PATENT_CPU_PACKAGE } from '@/lib/scene-fixtures/patent-cpu';

const layout = buildPatentLayout(PATENT_CPU_PACKAGE.atoms, PATENT_CPU_PACKAGE.relations);

describe('buildPatentLayout', () => {
  it('places every patent-node and patent-callout', () => {
    expect(layout.nodes).toHaveLength(8);
    expect(layout.callouts).toHaveLength(8);
  });

  it('resolves patent edges to placed endpoints with finite coordinates', () => {
    expect(layout.edges).toHaveLength(8);
    for (const edge of layout.edges) {
      expect(Number.isFinite(edge.x1)).toBe(true);
      expect(Number.isFinite(edge.y1)).toBe(true);
      expect(Number.isFinite(edge.x2)).toBe(true);
      expect(Number.isFinite(edge.y2)).toBe(true);
    }
  });

  it('layers the control unit above main memory (longest-path depth)', () => {
    const control = layout.nodes.find((node) => node.id === 'f1.control');
    const memory = layout.nodes.find((node) => node.id === 'f1.memory');
    expect(control).toBeDefined();
    expect(memory).toBeDefined();
    expect(control!.y).toBeLessThan(memory!.y);
  });

  it('maps each callout to its node via the leader relation, with numeral, description, and evidence', () => {
    const ten = layout.callouts.find((callout) => callout.numeral === '10');
    expect(ten).toBeDefined();
    expect(ten!.nodeId).toBe('f1.control');
    expect(ten!.nodeLabel).toBe('Control Unit');
    expect(ten!.description.length).toBeGreaterThan(0);
    expect(ten!.evidence.length).toBeGreaterThan(0);
    for (const callout of layout.callouts) {
      expect(callout.nodeLabel.length).toBeGreaterThan(0);
      expect(Number.isFinite(callout.x)).toBe(true);
      expect(Number.isFinite(callout.y)).toBe(true);
    }
  });

  it('emits a finite four-number viewBox', () => {
    const parts = layout.viewBox.split(' ').map(Number);
    expect(parts).toHaveLength(4);
    expect(parts.every(Number.isFinite)).toBe(true);
    expect(parts[2]).toBeGreaterThan(0);
    expect(parts[3]).toBeGreaterThan(0);
  });

  it('drops a callout whose target node is missing so the figure never dangles', () => {
    const orphan = buildPatentLayout(
      [{ id: 'c1', kind: 'patent-callout', label: '99', metadata: { numeral: '99', description: 'x' } }],
      [{ id: 'l1', sourceId: 'c1', targetId: 'missing', kind: 'patent-callout-leader' }],
    );
    expect(orphan.callouts).toHaveLength(0);
    expect(orphan.nodes).toHaveLength(0);
  });

  it('handles an empty package without throwing', () => {
    const empty = buildPatentLayout([], []);
    expect(empty.nodes).toHaveLength(0);
    expect(empty.callouts).toHaveLength(0);
    expect(empty.viewBox.split(' ')).toHaveLength(4);
  });
});
