import nextConfig from 'eslint-config-next';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// TW6 state boundary (SPEC-OBJECT-CONTRACT-V2 / HANDOFF-TWENTY-RECON): Jotai
// atoms live ONLY under the record-surface directories; zustand never appears
// inside them (it stays for app/session state elsewhere). Enforced as a path
// allowlist: the base config forbids importing jotai anywhere, and the
// record-surface override forbids zustand instead (which re-permits jotai there).
const RECORD_SURFACE_GLOBS = [
  'src/components/v2/record-table/**',
  'src/components/v2/kanban/**',
  'src/components/v2/data-canvas/**',
  'src/components/v2/surface/**',
  'src/lib/work-surface/**',
  'src/__tests__/record-table-store.test.ts',
];

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['jotai', 'jotai/*'],
              message:
                'TW6 state boundary: Jotai is allowed only under record-surface directories (record-table, kanban, data-canvas, surface, lib/work-surface). Use zustand for app/session state.',
            },
          ],
        },
      ],
    },
  },
  {
    files: RECORD_SURFACE_GLOBS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['zustand', 'zustand/*'],
              message:
                'TW6 state boundary: record-surface directories must use Jotai (atom-per-cell/node), not zustand.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
