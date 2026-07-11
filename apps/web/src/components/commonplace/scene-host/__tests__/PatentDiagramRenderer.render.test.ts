import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PatentDiagramRenderer from '../renderers/PatentDiagramRenderer';
import { PATENT_CPU_PACKAGE } from '@/lib/scene-fixtures/patent-cpu';

// Server render of the actual component (no browser / jsdom needed). Verifies it
// turns the patent atoms into SVG: node boxes, edges, and one rubricated numeral
// with a leader per callout, and that the detail panel is absent until a callout
// is selected (initial state).
const html = renderToStaticMarkup(createElement(PatentDiagramRenderer, { scenePackage: PATENT_CPU_PACKAGE }));

describe('PatentDiagramRenderer static render', () => {
  it('renders the patent figure scaffold', () => {
    expect(html).toContain('cp-patent-figure');
    expect(html).toContain('FIG. 1');
    expect(html).toContain('cp-patent-edge');
    expect(html).toContain('cp-patent-node');
  });

  it('renders one rubricated numeral and one leader per callout', () => {
    const numerals = html.match(/cp-patent-callout-num/g) ?? [];
    expect(numerals).toHaveLength(8);
    const leaders = html.match(/cp-patent-leader"/g) ?? [];
    expect(leaders).toHaveLength(8);
    for (const numeral of ['10', '12', '14', '16', '18', '20', '22', '24']) {
      expect(html).toContain(`>${numeral}</text>`);
    }
  });

  it('renders node labels (including wrapped multi-word labels)', () => {
    expect(html).toContain('Control Unit');
    expect(html).toContain('Arithmetic');
    expect(html).toContain('Main');
  });

  it('hides the evidence panel and go-deeper action until a callout is selected', () => {
    expect(html).not.toContain('cp-patent-panel');
    expect(html).not.toContain('Go deeper');
  });
});
