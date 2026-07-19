// SOURCING: Theorem /v1/theorem/turn/route contract. This server-only client
// forwards admitted tenant identity and never calls a model provider directly.

import { forwardAuthHeaders, localInquiryUrl } from '@commonplace/theorem-acp/node-upstream';
import type { TurnContext, TurnRoute } from '@commonplace/theorem-acp/state';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';

export type TurnPrelude = {
  readonly schema_version: 'turn-prelude/1';
  readonly route: TurnRoute;
  readonly confidence: number;
  readonly context_anchors: string[];
  readonly required_capabilities: string[];
  readonly acknowledgement: string | null;
  readonly acknowledgement_omission_reason: string | null;
  readonly fallback_reason: string | null;
};

export type RouteOverride = TurnRoute | undefined;

export class TurnRouterIdentityError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function routeTurn(
  input: string,
  principal: HarnessPrincipal,
  request: Request,
  explicitRoute?: RouteOverride,
): Promise<TurnPrelude> {
  let response: Response;
  try {
    response = await fetch(localInquiryUrl('/v1/theorem/turn/route'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...forwardAuthHeaders(request),
        'x-theorem-tenant': principal.tenant,
        'x-tenant-id': principal.tenant,
        'x-theorem-principal': principal.harnessIdentity,
      },
      body: JSON.stringify({
        tenant: principal.tenant,
        input,
        ...(explicitRoute ? { explicit_route: explicitRoute } : {}),
      }),
      cache: 'no-store',
      signal: request.signal,
    });
  } catch (error) {
    if (request.signal.aborted) throw error;
    return fallbackPrelude('router_unreachable', explicitRoute);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new TurnRouterIdentityError(
        'The turn router refused the authenticated tenant identity.',
        response.status,
      );
    }
    return fallbackPrelude(`router_http_${response.status}`, explicitRoute);
  }
  const payload = await response.json().catch(() => null) as unknown;
  return readTurnPrelude(payload) ?? fallbackPrelude('router_invalid_response', explicitRoute);
}

export function toTurnContext(prelude: TurnPrelude): TurnContext {
  return {
    schema_version: 'turn-context/1',
    route: prelude.route,
    published_acknowledgement: prelude.acknowledgement,
    context_anchors: prelude.context_anchors,
    required_capabilities: prelude.required_capabilities,
  };
}

export function explicitRouteForCapability(
  capability: { readonly kind: string } | undefined,
): RouteOverride {
  if (!capability) return undefined;
  if (capability.kind === 'web') return 'research';
  if (capability.kind === 'theorem') return 'chat';
  return 'agent';
}

function readTurnPrelude(payload: unknown): TurnPrelude | null {
  if (!payload || typeof payload !== 'object') return null;
  const prelude = (payload as { prelude?: unknown }).prelude;
  if (!prelude || typeof prelude !== 'object') return null;
  const value = prelude as Partial<TurnPrelude>;
  if (
    value.schema_version !== 'turn-prelude/1' ||
    (value.route !== 'chat' && value.route !== 'research' && value.route !== 'agent') ||
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    !Array.isArray(value.context_anchors) ||
    !value.context_anchors.every((anchor) => typeof anchor === 'string') ||
    !Array.isArray(value.required_capabilities) ||
    !value.required_capabilities.every((capability) => typeof capability === 'string') ||
    (value.acknowledgement !== null && typeof value.acknowledgement !== 'string')
  ) return null;
  return {
    schema_version: 'turn-prelude/1',
    route: value.route,
    confidence: value.confidence,
    context_anchors: value.context_anchors,
    required_capabilities: value.required_capabilities,
    acknowledgement: value.acknowledgement,
    acknowledgement_omission_reason:
      typeof value.acknowledgement_omission_reason === 'string'
        ? value.acknowledgement_omission_reason
        : null,
    fallback_reason: typeof value.fallback_reason === 'string' ? value.fallback_reason : null,
  };
}

function fallbackPrelude(reason: string, explicitRoute?: TurnRoute): TurnPrelude {
  const route = explicitRoute ?? 'agent';
  return {
    schema_version: 'turn-prelude/1',
    route,
    confidence: 0,
    context_anchors: [],
    required_capabilities:
      route === 'research'
        ? ['web_search', 'theorem_chat']
        : route === 'chat'
          ? ['theorem_chat']
          : ['theorem_agent'],
    acknowledgement: null,
    acknowledgement_omission_reason: 'router_fallback',
    fallback_reason: reason,
  };
}
