// @vitest-environment node
// SOURCING: none. Console Models consumer data-door acceptance tests.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  credentialHeadersMock,
  fetchMock,
  resolveHarnessPrincipalMock,
  resolveUpstreamCredentialMock,
} = vi.hoisted(() => ({
  credentialHeadersMock: vi.fn(),
  fetchMock: vi.fn(),
  resolveHarnessPrincipalMock: vi.fn(),
  resolveUpstreamCredentialMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: resolveHarnessPrincipalMock,
  principalTenantHeaders: () => ({ 'x-theorem-tenant': 'Travis-Gilbert' }),
}));
vi.mock('@/lib/server/upstream-credential', () => ({
  resolveUpstreamCredential: resolveUpstreamCredentialMock,
  credentialHeaders: credentialHeadersMock,
}));
vi.mock('@/lib/server/harness-timeout', () => ({
  startHarnessRequestTimeout: () => ({
    signal: undefined,
    didTimeout: () => false,
    clear: () => undefined,
  }),
}));

import { resetLocalDevDeclaredModelStore } from './local-dev-declared-model-store';
import {
  declareSchema,
  pinObserved,
  readObservedModels,
  unpinDeclared,
} from './observed-model-harness';

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'service:console-tests',
};

function graphqlResponse(data: Record<string, unknown>): Response {
  return Response.json({ data });
}

function emptyModelPayload(): Record<string, unknown> {
  return {
    observedModel: {
      event_count: 0,
      types: [],
      sources: [],
    },
    declaredModel: {
      object_types: [],
      views: [],
      versions: [],
      divergences: [],
    },
  };
}

beforeEach(() => {
  resetLocalDevDeclaredModelStore();
  fetchMock.mockReset();
  resolveHarnessPrincipalMock.mockReset();
  resolveUpstreamCredentialMock.mockReset();
  credentialHeadersMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('CONSOLE_DATA_API_URL', '');
  vi.stubEnv('THEOREM_GRAPHQL_URL', '');
  vi.stubEnv('CONSOLE_HARNESS_URL', '');
  resolveHarnessPrincipalMock.mockResolvedValue({ ok: true, principal });
  resolveUpstreamCredentialMock.mockResolvedValue({
    ok: true,
    credential: { kind: 'service_key', key: 'test-key' },
  });
  credentialHeadersMock.mockReturnValue({ 'x-api-key': 'test-key' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Console Models consumer GraphQL transport', () => {
  it('uses the data API when the agent endpoint is absent', async () => {
    vi.stubEnv('CONSOLE_DATA_API_URL', 'https://data.example');
    fetchMock.mockResolvedValue(graphqlResponse(emptyModelPayload()));

    const result = await readObservedModels('topic-one');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://data.example/graphql');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
      'x-api-key': 'test-key',
      'x-theorem-tenant': 'Travis-Gilbert',
    }));
    expect(JSON.parse(String(init.body))).toEqual(expect.objectContaining({
      variables: { topicId: 'topic-one' },
    }));
  });

  it('ignores an agent endpoint when the data API is unset and uses the named local stand-in', async () => {
    vi.stubEnv('CONSOLE_HARNESS_URL', 'https://agent.example/mcp');

    const result = await readObservedModels('topic-local');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected local stand-in result');
    expect(result.tenant).toBe('local-dev');
    expect(result.declared.objectTypes.map((type) => type.key)).toContain('customer');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolveHarnessPrincipalMock).not.toHaveBeenCalled();
  });

  it('does not fall back to local memory when a configured data API is unreachable', async () => {
    vi.stubEnv('CONSOLE_DATA_API_URL', 'https://data.example/graphql');
    fetchMock.mockRejectedValue(new Error('connection refused'));

    const result = await readObservedModels('topic-live');

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      status: 502,
      error: 'observed_model_graphql_unreachable',
    }));
    expect(result.declared.objectTypes).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not treat a colliding upstream GraphQL message as missing configuration', async () => {
    vi.stubEnv('CONSOLE_DATA_API_URL', 'https://data.example/graphql');
    fetchMock.mockResolvedValue(Response.json({
      errors: [{ message: 'observed_model_graphql_unconfigured' }],
    }));

    const result = await readObservedModels('topic-live');

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      status: 502,
      error: 'observed_model_graphql_unconfigured',
      reason: 'upstream_error',
    }));
    expect(result.declared.objectTypes).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends model mutations and the follow-up read through consumer GraphQL', async () => {
    vi.stubEnv('CONSOLE_DATA_API_URL', 'https://data.example/graphql');
    fetchMock
      .mockResolvedValueOnce(graphqlResponse({
        unpinDeclared: {
          action_kind: 'unpin',
          status: 'applied',
          target_ids: ['ot:customer'],
        },
      }))
      .mockResolvedValueOnce(graphqlResponse({
        declaredModel: emptyModelPayload().declaredModel,
      }));

    const result = await unpinDeclared('topic-one', 'ot:customer');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const mutationBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(mutationBody.query).toContain('mutation ConsoleUnpinDeclared');
    expect(mutationBody.variables).toEqual({ targetId: 'ot:customer' });
    const readBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      query: string;
    };
    expect(readBody.query).toContain('query ConsoleDeclaredModel');
  });

  it('sends pin input through the consumer mutation contract', async () => {
    vi.stubEnv('CONSOLE_DATA_API_URL', 'https://data.example/graphql');
    fetchMock
      .mockResolvedValueOnce(graphqlResponse({
        pinObserved: {
          action_kind: 'pin',
          status: 'applied',
          target_ids: ['article'],
        },
      }))
      .mockResolvedValueOnce(graphqlResponse({
        declaredModel: emptyModelPayload().declaredModel,
      }));

    const result = await pinObserved({
      scope: { kind: 'topic', topicId: 'topic-one' },
      observedKey: 'article',
      kind: 'type',
    });

    expect(result.ok).toBe(true);
    const mutationBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(mutationBody.query).toContain('mutation ConsolePinObserved');
    expect(mutationBody.variables).toEqual({
      input: {
        topic_id: 'topic-one',
        kind: 'type',
        data_type: 'article',
      },
    });
  });

  it('serializes schema declarations onto the consumer mutation', async () => {
    vi.stubEnv('CONSOLE_DATA_API_URL', 'https://data.example/graphql');
    fetchMock
      .mockResolvedValueOnce(graphqlResponse({
        declareSchema: {
          status: 'declared',
          idempotent_replay: false,
          object_type: { object_type_id: 'ot:shipment' },
          graph_version_after: 2,
        },
      }))
      .mockResolvedValueOnce(graphqlResponse({
        declaredModel: emptyModelPayload().declaredModel,
      }));

    const result = await declareSchema('topic-one', {
      nameSingular: 'shipment',
      namePlural: 'shipments',
      labelSingular: 'Shipment',
      labelPlural: 'Shipments',
      nodeLabel: 'Shipment',
      labelIdentifierField: 'id',
      fields: [{
        key: 'id',
        label: 'Id',
        fieldType: { kind: 'uuid' },
        required: true,
        system: true,
      }],
      enforcement: 'warn',
      system: false,
    });

    expect(result.ok).toBe(true);
    const mutationBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: { input: Record<string, unknown> };
    };
    expect(mutationBody.query).toContain('mutation ConsoleDeclareSchema');
    expect(mutationBody.variables.input).toEqual(expect.objectContaining({
      name_singular: 'shipment',
      name_plural: 'shipments',
      node_label: 'Shipment',
      label_identifier_field: 'id',
      enforcement: 'warn',
    }));
  });
});
