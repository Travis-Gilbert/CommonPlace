import { describe, expect, it } from 'vitest';
import {
  EDGE_DASH,
  EDGE_DASH_CYCLE,
  EDGE_STROKE,
  RUNNING_EDGE_ANIMATION_CAP,
  edgeAttention,
  edgeStroke,
  edgeStrokeStyle,
  familyStroke,
  marchingEdgeIds,
} from './law';

describe('edge dash law', () => {
  it('rests as round dots and tightens under attention without going solid', () => {
    expect(EDGE_DASH.rest).toBe('0.1 6');
    expect(EDGE_DASH.attended).toBe('4 3');
    expect(edgeStrokeStyle('rest')).toEqual({
      strokeWidth: EDGE_STROKE.rest,
      strokeDasharray: '0.1 6',
      strokeLinecap: 'round',
    });
    // Attention must not remove the dash: solidifying is a dash change, not a
    // state jump to a different mark.
    expect(edgeStrokeStyle('attended').strokeDasharray).not.toBe('none');
    expect(edgeStrokeStyle('attended').strokeWidth).toBeGreaterThan(EDGE_STROKE.rest);
  });

  it('marches by exactly one dash cycle so the loop seams', () => {
    const [dash, gap] = EDGE_DASH.rest.split(' ').map(Number);
    expect(EDGE_DASH_CYCLE).toBeCloseTo(dash + gap);
  });

  it('treats hover and selection as the same attention', () => {
    expect(edgeAttention(true, false)).toBe('attended');
    expect(edgeAttention(false, true)).toBe('attended');
    expect(edgeAttention(false, false)).toBe('rest');
  });
});

describe('two palettes, one geometry', () => {
  it('gives program edges the source family and model edges neutral ink', () => {
    expect(edgeStroke('program', 'tabular', 'rest')).toBe(familyStroke('tabular'));
    expect(edgeStroke('model', 'tabular', 'rest')).toBe('var(--ij-ink-info)');
    expect(edgeStroke('model', 'tabular', 'attended')).toBe('var(--ij-accent)');
  });

  it('never mints a colour outside the register', () => {
    const families = [
      'graph-plane',
      'tabular',
      'tensor-and-model',
      'scalar-value',
      'artifact-and-sink',
    ] as const;
    for (const family of families) {
      expect(familyStroke(family)).toMatch(/^var\(--ij-/);
    }
    // The hue budget is five families and no more.
    expect(new Set(families.map(familyStroke)).size).toBe(5);
  });
});

describe('running-edge animation budget', () => {
  const ids = Array.from({ length: 60 }, (_, index) => `edge-${index}`);

  it('caps concurrent marching edges so a fan-out cannot strobe', () => {
    const marching = marchingEdgeIds(ids, { reducedMotion: false });
    expect(marching.size).toBe(RUNNING_EDGE_ANIMATION_CAP);
    expect(marching.has('edge-0')).toBe(true);
    expect(marching.has(`edge-${RUNNING_EDGE_ANIMATION_CAP}`)).toBe(false);
  });

  it('animates nothing under reduced motion, at any count', () => {
    expect(marchingEdgeIds(ids, { reducedMotion: true }).size).toBe(0);
    expect(marchingEdgeIds(['solo'], { reducedMotion: true }).size).toBe(0);
  });

  it('leaves a small run entirely animated', () => {
    expect(marchingEdgeIds(['a', 'b'], { reducedMotion: false }).size).toBe(2);
  });
});
