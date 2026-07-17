import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// The import fence (HANDOFF-GREENFIELD-CONSOLE G1, PLAN-GREENFIELD-ALIGNMENT
// section 3): apps/console cannot import from apps/web, directly or by any
// alias. The only legal way code moves from apps/web is extraction into
// packages/* first. scripts/check-import-fence.mjs enforces the same rule as
// a CI grep assertion so the fence is structural, not advisory.
const FENCE_PATTERNS = [
  {
    group: ['**/apps/web/**', 'apps/web/**'],
    message: 'apps/console cannot import from apps/web. Extract to packages/* first (porting is extraction).',
  },
  {
    group: ['@commonplace/web', '@commonplace/web/**'],
    message: 'apps/console cannot depend on @commonplace/web. Extract to packages/* first.',
  },
  {
    group: ['../../web/**', '../../../*', '../../../**'],
    message: 'Relative imports may not escape apps/console except into packages/* via the package name.',
  },
];

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: FENCE_PATTERNS,
        },
      ],
    },
  },
];

export default eslintConfig;
