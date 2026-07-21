#!/usr/bin/env node
// SOURCING: none. Pure logic.
// Homogeneous-island gate (HANDOFF-CONSOLE-ISLAND-SHELL): every proving surface
// with three or more islands must declare at least two base classes.

/**
 * Proving surfaces: editor island (EditorTabs) plus open companions.
 * Classes mirror workspace-seed companions (tool) + editor region (editor).
 */
const PROVING_SURFACES = [
  {
    name: 'workspace (editor + files + context + thread)',
    classes: ['editor', 'tool', 'tool', 'tool'],
  },
  {
    name: 'cards (cards.grid + companions)',
    classes: ['editor', 'tool', 'tool', 'tool'],
  },
  {
    name: 'chat (editor + companions; chat.surface mounts in editor)',
    classes: ['editor', 'tool', 'tool', 'tool'],
  },
  {
    name: 'island-grid homogeneous defect fixture (must fail the helper)',
    classes: ['tool', 'tool', 'tool'],
    expectDefect: true,
  },
];

function hasHomogeneousIslandDefect(classes) {
  if (classes.length < 3) return false;
  return new Set(classes).size < 2;
}

const violations = [];

for (const surface of PROVING_SURFACES) {
  const defect = hasHomogeneousIslandDefect(surface.classes);
  if (surface.expectDefect) {
    if (!defect) {
      violations.push(
        `${surface.name}: expected homogeneous defect, helper returned false`,
      );
    }
    continue;
  }
  if (defect) {
    violations.push(
      `${surface.name}: homogeneous classes [${surface.classes.join(', ')}]`,
    );
  }
}

if (violations.length > 0) {
  console.error('Island class gate failed:');
  for (const line of violations) console.error(`  - ${line}`);
  console.error(
    'Fix: a surface with three or more islands needs at least two of {tool, editor}.',
  );
  process.exit(1);
}

console.log(
  'Island class gate passed (%d proving surfaces).',
  PROVING_SURFACES.filter((s) => !s.expectDefect).length,
);
