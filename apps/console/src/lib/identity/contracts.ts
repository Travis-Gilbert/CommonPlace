// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=frontend/src/models/{invite,workspace,admin}.js.
// The fetch model is typed and retargeted to the FK3 identity-only service.

import { z } from 'zod';

export const IdentityUserStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'DISABLED',
]);

export const IdentityUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  status: IdentityUserStatusSchema,
});

export const ActiveIdentityUserSchema = IdentityUserSchema.extend({
  status: z.literal('ACTIVE'),
});

export const WorkspaceRoleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  permissions: z.array(z.string()),
});

export const IdentityWorkspaceSchema = z.object({
  id: z.string().min(1),
  tenant: z.string().min(1),
  slug: z.string().min(1),
  scopeRef: z.string().min(1),
  name: z.string().min(1),
  role: WorkspaceRoleSchema,
});

export const IdentitySessionSchema = z.object({
  user: ActiveIdentityUserSchema,
  workspaces: z.array(IdentityWorkspaceSchema),
  onboardingComplete: z.boolean(),
});

// Public inspection returns only an active pending invitation. Claimed,
// revoked, and expired records are refusals and never cross this contract.
export const InviteSchema = z.object({
  id: z.string().min(1),
  workspace: z.object({
    id: z.string().min(1),
    tenant: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
  }),
  role: z.object({
    id: z.string().min(1),
    key: z.string().min(1),
    name: z.string().min(1),
  }),
  email: z.string().nullable(),
  status: z.literal('PENDING'),
  expiresAt: z.string().datetime(),
});

export const ApiKeyMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  prefix: z.string().min(1),
  scopes: z.array(z.string()),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable().optional(),
});

export const AdminOverviewTruncationSchema = z.object({
  users: z.boolean(),
  workspaces: z.boolean(),
  pendingInvites: z.boolean(),
});

export const AdminOverviewSchema = z.object({
  users: z.array(IdentityUserSchema),
  workspaces: z.array(
    z.object({
      id: z.string().min(1),
      tenant: z.string().min(1),
      slug: z.string().min(1),
      scopeRef: z.string().min(1),
      name: z.string().min(1),
    }),
  ),
  pendingInvites: z.array(InviteSchema),
  truncated: AdminOverviewTruncationSchema,
});

export const DocumentIngestReceiptSchema = z.object({
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  scopeRef: z.string().min(1),
  receipts: z.array(
    z.object({
      item: z.object({
        id: z.string().min(1),
        title: z.string().optional(),
        collections: z.array(z.string()).optional(),
      }).passthrough(),
      correlationId: z.string().min(1),
      idempotencyKey: z.string().min(1),
      documentIndex: z.number().int().nonnegative(),
      documentDigest: z.string().min(1),
    }),
  ).min(1),
});

export type IdentitySession = z.infer<typeof IdentitySessionSchema>;
export type IdentityWorkspace = z.infer<typeof IdentityWorkspaceSchema>;
export type IdentityInvite = z.infer<typeof InviteSchema>;
export type ApiKeyMeta = z.infer<typeof ApiKeyMetaSchema>;
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;
export type DocumentIngestReceipt = z.infer<typeof DocumentIngestReceiptSchema>;
