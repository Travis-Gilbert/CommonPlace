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
    // React Compiler lint rules (eslint-plugin-react-hooks v6, pulled in by an
    // eslint-config-next upgrade) as WARN, not error. They flag advisory
    // patterns (synchronous setState in effects, ref reads during render,
    // impurity) across ~117 pre-existing, working components that predate the
    // rules. Treating them as hard errors would gate every PR on a codebase-wide
    // refactor with real regression risk and no user-facing benefit; keeping them
    // as warnings surfaces the work for gradual adoption (the plugin's own
    // recommended path) without blocking. New code should still avoid them.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/set-state-in-render': 'warn',
    },
  },
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
