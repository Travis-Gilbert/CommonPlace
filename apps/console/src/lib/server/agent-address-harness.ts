// SOURCING: none. Same-origin adapter for agent-address alias GraphQL.

import 'server-only';

import { callHarnessGraphql } from '@/lib/server/harness-graphql';

export type AliasBlock = {
  readonly alias: string;
  readonly userSlug: string;
  readonly counterparty: string;
  readonly createdAt: string;
  readonly status: string;
  readonly address: string;
};

export async function listAgentAliases(userSlug: string): Promise<
  | { readonly ok: true; readonly aliases: AliasBlock[]; readonly domain: string }
  | { readonly ok: false; readonly status: number; readonly error: string }
> {
  const result = await callHarnessGraphql(
    `query AgentAliases($userSlug: String!) {
      agentAliases(userSlug: $userSlug) {
        alias userSlug counterparty createdAt status address
      }
      agentMailDomain
    }`,
    { userSlug },
  );
  if (!result.ok) return { ok: false, status: result.status, error: result.error };
  const aliases = (result.data.agentAliases as AliasBlock[] | undefined) ?? [];
  const domain = String(result.data.agentMailDomain ?? '');
  return { ok: true, aliases, domain };
}

export async function mintAgentAlias(input: {
  alias: string;
  userSlug: string;
  counterparty: string;
}): Promise<
  | { readonly ok: true; readonly alias: AliasBlock }
  | { readonly ok: false; readonly status: number; readonly error: string }
> {
  const result = await callHarnessGraphql(
    `mutation MintAlias($alias: String!, $userSlug: String!, $counterparty: String!) {
      mintAgentAlias(alias: $alias, userSlug: $userSlug, counterparty: $counterparty) {
        alias userSlug counterparty createdAt status address
      }
    }`,
    input,
  );
  if (!result.ok) return { ok: false, status: result.status, error: result.error };
  return { ok: true, alias: result.data.mintAgentAlias as AliasBlock };
}

export async function revokeAgentAlias(alias: string): Promise<
  | { readonly ok: true; readonly alias: AliasBlock }
  | { readonly ok: false; readonly status: number; readonly error: string }
> {
  const result = await callHarnessGraphql(
    `mutation RevokeAlias($alias: String!) {
      revokeAgentAlias(alias: $alias) {
        alias userSlug counterparty createdAt status address
      }
    }`,
    { alias },
  );
  if (!result.ok) return { ok: false, status: result.status, error: result.error };
  return { ok: true, alias: result.data.revokeAgentAlias as AliasBlock };
}
