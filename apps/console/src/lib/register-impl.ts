// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 named choice 6.
// Maps registry descriptor ids to manifest_impl identities the doctor reads.
// scripts/check-register-manifest.mjs verifies this map against
// .commonplace-canonical.

export const REGISTER_IMPL_BY_DESCRIPTOR = {
  'chat.surface': 'openwork.chat',
  'record.table': 'console.record.table',
  'model.studio': 'model-canvas.owox',
  'markdown.doc': 'console.markdown.doc',
  'code.file': 'console.code.file',
  'goal.stack': 'console.goal.stack',
  'harness.status': 'console.harness.status',
} as const;

export type RegisterImplId =
  (typeof REGISTER_IMPL_BY_DESCRIPTOR)[keyof typeof REGISTER_IMPL_BY_DESCRIPTOR];

export function registerImplForDescriptor(
  descriptorId: string | null | undefined,
): string | undefined {
  if (!descriptorId) return undefined;
  return REGISTER_IMPL_BY_DESCRIPTOR[
    descriptorId as keyof typeof REGISTER_IMPL_BY_DESCRIPTOR
  ];
}
