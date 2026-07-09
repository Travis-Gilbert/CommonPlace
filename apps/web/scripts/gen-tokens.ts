// TW1: Regenerate porcelain-theme.css from the solver.
// Run: pnpm gen:tokens
// The solver measures proportions from the running Twenty product and emits
// calibrated CSS custom properties. No hex/px literals in component files.

import { writeTokensFile } from '@/lib/theme/porcelain-solver';

const axes = {
  baseFontSize: 16,
  spacingUnit: 4,
  compactness: 1.0,
};

writeTokensFile(axes);
