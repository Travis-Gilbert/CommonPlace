import { describe, expect, it } from 'vitest';
import { widgetFieldTypeForShape } from './programNodeKind';
import { isWidgetizableShape, shapeClassFor } from './shapeHue';

describe('shape family projection', () => {
  it('maps every declared shape kind to a family', () => {
    const kinds = [
      'graph_nodes',
      'node_scores',
      'tabular_any',
      'tabular_pair',
      'join_columns',
      'preserve_columns',
      'variables_declared_at_init',
      'preserve_or_replace_variables',
      'function',
      'other',
    ] as const;
    for (const kind of kinds) {
      expect(shapeClassFor(kind)).toBeTruthy();
    }
    expect(shapeClassFor('graph_nodes')).toBe('graph-plane');
    expect(shapeClassFor('tabular_any')).toBe('tabular');
    expect(shapeClassFor('function')).toBe('tensor-and-model');
    expect(shapeClassFor('other')).toBe('artifact-and-sink');
  });

  it('keeps an unresolvable shape visible rather than unstyled', () => {
    // An invisible wire is worse than a miscoloured one.
    expect(shapeClassFor(undefined)).toBe('scalar-value');
    expect(shapeClassFor('not_a_real_kind')).toBe('scalar-value');
  });
});

describe('widgetizable shapes', () => {
  it('offers a control only where typing is a real affordance', () => {
    // A scalar parameter can be typed; a whole tabular or graph plane cannot,
    // and a JSON textarea standing in for a table would be a fake affordance.
    expect(isWidgetizableShape('variables_declared_at_init')).toBe(true);
    expect(isWidgetizableShape('preserve_or_replace_variables')).toBe(true);
    expect(isWidgetizableShape('other')).toBe(true);
    expect(isWidgetizableShape('tabular_any')).toBe(false);
    expect(isWidgetizableShape('graph_nodes')).toBe(false);
    expect(isWidgetizableShape('function')).toBe(false);
  });

  it('leaves at least one shape on each side of the line', () => {
    // A rule that made every shape unwidgetizable would silently disable
    // widgets-on-node; one that made every shape widgetizable would empty the
    // advanced section. Both sides have to stay populated.
    const kinds = [
      'graph_nodes', 'node_scores', 'tabular_any', 'tabular_pair', 'join_columns',
      'preserve_columns', 'variables_declared_at_init',
      'preserve_or_replace_variables', 'function', 'other',
    ];
    expect(kinds.some(isWidgetizableShape)).toBe(true);
    expect(kinds.some((kind) => !isWidgetizableShape(kind))).toBe(true);
  });

  it('edits a variable bag as JSON and everything else as a value', () => {
    expect(widgetFieldTypeForShape('variables_declared_at_init')).toEqual({ kind: 'json' });
    expect(widgetFieldTypeForShape('other')).toEqual({ kind: 'text' });
  });
});
