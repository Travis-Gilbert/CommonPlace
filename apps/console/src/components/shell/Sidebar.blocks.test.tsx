// SOURCING: none. CN2 unit oracle for registry-derived Blocks rendering.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  deriveBlockPaletteItems,
  type ConsoleViewDescriptor,
} from '@/lib/rail/rail-model';
import {
  CONSOLE_VIEW_DESCRIPTORS,
  CONSOLE_VIEW_REGISTRY,
} from '@/views/registry';
import { SidebarBlocksGroup } from './Sidebar';

describe('Sidebar Blocks group', () => {
  it('renders exactly one row per palette-visible registry descriptor', () => {
    const items = deriveBlockPaletteItems(CONSOLE_VIEW_REGISTRY.descriptors);
    const visibleCount = CONSOLE_VIEW_DESCRIPTORS.filter(
      (descriptor) => descriptor.paletteVisible === true,
    ).length;
    const markup = renderToStaticMarkup(
      <SidebarBlocksGroup
        items={items}
        visuallyCollapsed={false}
        onAddBlock={() => undefined}
      />,
    );

    expect(markup.match(/data-block-palette=/g) ?? []).toHaveLength(visibleCount);
    expect(items).toHaveLength(visibleCount);
  });

  it('includes Canvas from registry metadata with no Sidebar membership entry', () => {
    const items = deriveBlockPaletteItems(CONSOLE_VIEW_REGISTRY.descriptors);

    expect(items).toContainEqual({
      id: 'canvas',
      label: 'Canvas',
      kind: 'canvas',
      descriptorId: 'canvas',
      material: 'sunken',
    });
  });

  it('renders an added descriptor without a Sidebar membership edit', () => {
    const added: ConsoleViewDescriptor = {
      ...CONSOLE_VIEW_DESCRIPTORS[0],
      id: 'test.added',
      name: 'Added block',
      renderer: 'test.added',
      paletteVisible: true,
      palette: {
        id: 'added',
        kind: 'records',
        material: 'sunken',
      },
    };
    const items = deriveBlockPaletteItems([...CONSOLE_VIEW_DESCRIPTORS, added]);
    const markup = renderToStaticMarkup(
      <SidebarBlocksGroup
        items={items}
        visuallyCollapsed={false}
        onAddBlock={() => undefined}
      />,
    );

    expect(markup).toContain('data-block-palette="added"');
    expect(markup.match(/data-block-palette=/g) ?? []).toHaveLength(
      CONSOLE_VIEW_DESCRIPTORS.filter((descriptor) => descriptor.paletteVisible === true).length + 1,
    );
  });

  it('keeps registry drop semantics on the intended descriptor boundaries', () => {
    expect(CONSOLE_VIEW_REGISTRY.viewById('kanban')?.block?.acceptsDrop).toEqual({
      semantic: 'contain',
      layout: 'columns',
      accepts: ['*'],
    });
    expect(CONSOLE_VIEW_REGISTRY.viewById('model.studio')?.block?.acceptsDrop).toEqual({
      semantic: 'relate',
    });
    expect(CONSOLE_VIEW_REGISTRY.viewById('canvas')?.block?.acceptsDrop).toBeUndefined();
  });
});
