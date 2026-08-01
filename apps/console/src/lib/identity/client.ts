'use client';

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=frontend/src/models/{invite,workspace,admin}.js.
// Retyped and retargeted to same-origin FK3 routes.

import { z, type ZodType } from 'zod';
import {
  AdminOverviewSchema,
  ApiKeyMetaSchema,
  DocumentIngestReceiptSchema,
  IdentitySessionSchema,
  IdentityWorkspaceSchema,
  InviteSchema,
  type AdminOverview,
  type ApiKeyMeta,
  type DocumentIngestReceipt,
  type IdentityInvite,
  type IdentitySession,
  type IdentityWorkspace,
} from './contracts';

export class IdentityClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'IdentityClientError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(
  path: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    const bodyCarriesContentType =
      init?.body instanceof FormData || init?.body instanceof Blob;
    response = await fetch(path, {
      cache: 'no-store',
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.body && !bodyCarriesContentType
          ? { 'content-type': 'application/json' }
          : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new IdentityClientError(
      0,
      'identity_proxy_unreachable',
      'The identity service could not be reached',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new IdentityClientError(
      response.status,
      'identity_response_invalid',
      'The identity service returned an invalid response',
    );
  }
  if (!response.ok) {
    const error = z.object({
      error: z.string().optional(),
      message: z.string().optional(),
    }).safeParse(payload);
    throw new IdentityClientError(
      response.status,
      error.success ? error.data.error ?? 'identity_request_failed' : 'identity_request_failed',
      error.success ? error.data.message ?? 'The identity request failed' : 'The identity request failed',
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new IdentityClientError(
      502,
      'identity_contract_mismatch',
      'The identity service response did not match the page contract',
    );
  }
  return parsed.data;
}

export function getIdentitySession(): Promise<IdentitySession> {
  return requestJson('/api/identity/session', IdentitySessionSchema);
}

export async function createIdentityWorkspace(input: {
  readonly name: string;
  readonly slug: string;
}): Promise<IdentityWorkspace> {
  const result = await requestJson(
    '/api/identity/workspaces',
    z.object({ workspace: IdentityWorkspaceSchema }),
    { method: 'POST', body: JSON.stringify(input) },
  );
  return result.workspace;
}

export async function updateIdentityWorkspace(
  workspaceId: string,
  input: { readonly name: string },
): Promise<IdentityWorkspace> {
  const result = await requestJson(
    `/api/identity/workspaces/${encodeURIComponent(workspaceId)}`,
    z.object({ workspace: IdentityWorkspaceSchema }),
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return result.workspace;
}

export async function inspectIdentityInvite(code: string): Promise<IdentityInvite> {
  const result = await requestJson(
    `/api/identity/invites/${encodeURIComponent(code)}`,
    z.object({ invite: InviteSchema }),
  );
  return result.invite;
}

export async function acceptIdentityInvite(code: string): Promise<IdentityWorkspace> {
  const result = await requestJson(
    `/api/identity/invites/${encodeURIComponent(code)}`,
    z.object({ workspace: IdentityWorkspaceSchema }),
    { method: 'POST' },
  );
  return result.workspace;
}

export async function createIdentityInvite(
  workspaceId: string,
  input: { readonly email?: string },
): Promise<{ readonly invite: IdentityInvite; readonly code: string }> {
  return requestJson(
    `/api/identity/workspaces/${encodeURIComponent(workspaceId)}/invites`,
    z.object({ invite: InviteSchema, code: z.string().min(1) }),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function listIdentityApiKeys(
  workspaceId: string,
): Promise<readonly ApiKeyMeta[]> {
  const result = await requestJson(
    `/api/identity/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
    z.object({ apiKeys: z.array(ApiKeyMetaSchema) }),
  );
  return result.apiKeys;
}

export async function createIdentityApiKey(
  workspaceId: string,
  input: { readonly name: string },
): Promise<{
  readonly key: string;
  readonly record: ApiKeyMeta;
  readonly revocationCacheSeconds: number;
}> {
  return requestJson(
    `/api/identity/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
    z.object({
      key: z.string().min(1),
      record: ApiKeyMetaSchema,
      revocationCacheSeconds: z.number().int().positive(),
    }),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function revokeIdentityApiKey(
  workspaceId: string,
  keyId: string,
): Promise<void> {
  await requestJson(
    `/api/identity/workspaces/${encodeURIComponent(workspaceId)}`
      + `/api-keys/${encodeURIComponent(keyId)}`,
    z.object({ revoked: z.literal(true) }),
    { method: 'DELETE' },
  );
}

export function getIdentityAdminOverview(): Promise<AdminOverview> {
  return requestJson('/api/identity/admin', AdminOverviewSchema);
}

export async function selectIdentityWorkspace(
  workspaceId: string,
): Promise<IdentityWorkspace> {
  const result = await requestJson(
    '/api/identity/active-workspace',
    z.object({ workspace: IdentityWorkspaceSchema }),
    { method: 'POST', body: JSON.stringify({ workspaceId }) },
  );
  return result.workspace;
}

const DOCUMENT_MEDIA_TYPES: Readonly<Record<string, string>> = Object.freeze({
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  text: 'text/plain',
});

function documentMediaType(file: File): string {
  const declared = file.type.trim();
  if (declared) return declared;
  const separator = file.name.lastIndexOf('.');
  const extension =
    separator >= 0 ? file.name.slice(separator + 1).toLowerCase() : '';
  return DOCUMENT_MEDIA_TYPES[extension] ?? 'application/octet-stream';
}

export function uploadIdentityWorkspaceDocument(
  workspaceId: string,
  file: File,
  tags: readonly string[] = [],
): Promise<DocumentIngestReceipt> {
  const query = new URLSearchParams({ filename: file.name });
  for (const tag of tags) query.append('tag', tag);
  return requestJson(
    `/api/identity/workspaces/${encodeURIComponent(workspaceId)}/documents?${query}`,
    DocumentIngestReceiptSchema,
    {
      method: 'POST',
      body: file,
      headers: {
        'content-type': documentMediaType(file),
      },
    },
  );
}
