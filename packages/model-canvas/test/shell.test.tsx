import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ModelGraph } from '@commonplace/okf';
import { ModelCanvasShell } from '../src/ModelCanvasShell';

function graph(key: string, title: string): ModelGraph {
  return {
    storageId: null,
    nodes: [{
      key,
      title,
      inputSource: 'TABLE',
      schema: [],
      position: { x: 0, y: 0 },
      status: 'created',
      owoxId: null,
    }],
    edges: [],
  };
}

describe('ModelCanvasShell controlled graph', () => {
  it('reconciles registry-authored node data and topology', () => {
    const view = render(<ModelCanvasShell graph={graph('orders', 'Orders')} />);
    expect(screen.getByText('Orders')).toBeInTheDocument();

    view.rerender(<ModelCanvasShell graph={graph('customers', 'Customers')} />);

    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
  });
});
