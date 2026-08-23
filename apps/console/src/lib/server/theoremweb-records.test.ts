import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-mcp', () => ({
  callHarnessMcp: vi.fn(),
}));

import {
  applyTheoremwebRecordAction,
  loadTheoremwebRecordPage,
} from './theoremweb-records';

type Call = { name: string; arguments: Record<string, unknown> };

const objectType = {
  object_type_id: 'company',
  tenant_id: 'tenant-from-server',
  name_singular: 'company',
  name_plural: 'companies',
  label_singular: 'Company',
  label_plural: 'Companies',
  node_label: 'Company',
  label_identifier_field: 'name',
  fields: [
    { key: 'name', label: 'Name', field_type: { kind: 'text' }, required: true, system: false },
    {
      key: 'revenue',
      label: 'Revenue',
      field_type: { kind: 'number' },
      required: false,
      system: false,
    },
  ],
  enforcement: 'reject',
  system: false,
  content_anchor: 'schema:company',
  retired: false,
  schema_version: 'v1',
};

const qualifiedView = {
  view_id: 'view:qualified',
  tenant_id: 'tenant-from-server',
  object_type_id: 'company',
  name: 'Qualified',
  schema_version: 'v1',
  filters: [{ field_key: 'revenue', operator: 'greater_than', value: 10 }],
  sorts: [{ field_key: 'revenue', direction: 'desc' }],
  columns: [],
};

describe('theoremweb graph-backed records', () => {
  const calls: Call[] = [];

  beforeEach(() => calls.splice(0));

  function successfulCall() {
    return async (name: string, argumentsValue: Record<string, unknown>) => {
      calls.push({ name, arguments: argumentsValue });
      const data = (() => {
        switch (name) {
          case 'surface_get':
            return { surface: { surface_id: 'records', layout_ref: 'layout:workspace:records' } };
          case 'layout_get':
            return {
              layout: {
                layout_id: 'layout:workspace:records',
                tabs: [{
                  widgets: [{
                    body_kind: 'record_table',
                    body_params: {
                      name_singular: 'company',
                      view_id: 'view:qualified',
                    },
                  }],
                }],
              },
            };
          case 'schema_get':
            return objectType;
          case 'view_get':
            return { view: qualifiedView };
          case 'view_list':
            return { views: [qualifiedView], count: 1 };
          case 'invoke':
            if (argumentsValue.name === 'aggregate_companies') {
              return { field: 'revenue', op: 'sum', value: 50, available: true };
            }
            if (argumentsValue.name === 'update_one_company') {
              return { record: { id: 'company:acme', properties: { name: 'Acme 2' } } };
            }
            return {
              records: [{
                id: 'company:acme',
                properties: { id: 'company:acme', name: 'Acme', revenue: 30 },
              }],
              count: 2,
            };
          case 'stream_read':
            return {
              events: [{
                actor: 'head:qwen',
                kind: 'view.focus',
                payload: {
                  viewId: 'view:qualified',
                  objectTypeId: 'company',
                  recordId: 'company:acme',
                  actorKind: 'head',
                  displayName: 'Qwen',
                },
              }],
            };
          case 'stream_publish':
            return { event: { kind: argumentsValue.kind } };
          case 'view_upsert':
            return { view: argumentsValue.view };
          default:
            throw new Error(`unexpected tool ${name}`);
        }
      })();
      return {
        ok: true as const,
        data,
        principal: {
          tenant: 'tenant-from-session',
          githubLogin: 'octocat',
          harnessIdentity: 'github:1',
        },
      };
    };
  }

  it('resolves surface layout schema and view before loading a server-counted page', async () => {
    const result = await loadTheoremwebRecordPage(
      'records',
      { offset: 20, limit: 1 },
      successfulCall(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page).toMatchObject({
      object_type: { object_type_id: 'company' },
      view: { view_id: 'view:qualified' },
      rows: [{ record_id: 'company:acme', values: { name: 'Acme' } }],
      total: 2,
      presence_events: [{ actor: 'head:qwen', kind: 'view.focus' }],
    });
    expect(calls.slice(0, 3).map(({ name }) => name)).toEqual([
      'surface_get',
      'layout_get',
      'schema_get',
    ]);
    expect(calls.find(({ name }) => name === 'invoke')).toEqual({
      name: 'invoke',
      arguments: {
        name: 'find_many_companies',
        arguments: {
          filters: qualifiedView.filters,
          sorts: qualifiedView.sorts,
          offset: 20,
          limit: 1,
        },
      },
    });
    for (const call of calls) {
      expect(call.arguments).not.toHaveProperty('tenant');
      expect(call.arguments).not.toHaveProperty('tenant_slug');
      expect(call.arguments).not.toHaveProperty('actor');
    }
  });

  it('publishes a write only after an accepted schema-enforced edit', async () => {
    const result = await applyTheoremwebRecordAction(
      'records',
      { action: 'edit', recordId: 'company:acme', fieldKey: 'name', value: 'Acme 2' },
      {},
      successfulCall(),
    );

    expect(result.ok).toBe(true);
    const updateIndex = calls.findIndex(
      ({ arguments: value }) => value.name === 'update_one_company',
    );
    const publishIndex = calls.findIndex(({ name }) => name === 'stream_publish');
    expect(updateIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(updateIndex);
    expect(calls[publishIndex]).toMatchObject({
      arguments: {
        stream: 'view:view:qualified',
        kind: 'view.write',
        payload: {
          viewId: 'view:qualified',
          objectTypeId: 'company',
          recordId: 'company:acme',
        },
      },
    });
  });

  it('preserves a rejected edit response and emits no false write event', async () => {
    const fallback = successfulCall();
    const refusal = Response.json({ error: 'schema_enforcement_rejected' }, { status: 422 });
    const call = async (name: string, argumentsValue: Record<string, unknown>) => {
      if (name === 'invoke' && argumentsValue.name === 'update_one_company') {
        calls.push({ name, arguments: argumentsValue });
        return { ok: false as const, response: refusal };
      }
      return fallback(name, argumentsValue);
    };

    const result = await applyTheoremwebRecordAction(
      'records',
      { action: 'edit', recordId: 'company:acme', fieldKey: 'name', value: null },
      {},
      call,
    );

    expect(result).toEqual({ ok: false, response: refusal });
    expect(calls.some(({ name }) => name === 'stream_publish')).toBe(false);
  });

  it('aggregates the persisted full filtered set without page controls', async () => {
    const result = await applyTheoremwebRecordAction(
      'records',
      { action: 'aggregate', fieldKey: 'revenue', operation: 'sum' },
      { offset: 50, limit: 1 },
      successfulCall(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.aggregate).toEqual({
      field: 'revenue',
      op: 'sum',
      value: 50,
      available: true,
    });
    const aggregate = calls.find(
      ({ arguments: value }) => value.name === 'aggregate_companies',
    );
    expect(aggregate?.arguments.arguments).toEqual({
      filters: qualifiedView.filters,
      sorts: qualifiedView.sorts,
      field: 'revenue',
      op: 'sum',
    });
  });

  it('reloads the server-returned save-as view without trusting browser tenancy', async () => {
    const copiedView = {
      ...qualifiedView,
      view_id: 'view:qualified:copy',
      name: 'Qualified copy',
      tenant_id: 'forged-browser-tenant',
    };
    const result = await applyTheoremwebRecordAction(
      'records',
      { action: 'save_view', view: copiedView },
      { viewId: 'view:qualified' },
      successfulCall(),
    );

    expect(result.ok).toBe(true);
    const save = calls.find(({ name }) => name === 'view_upsert');
    expect(save?.arguments.view).toMatchObject({
      view_id: 'view:qualified:copy',
      object_type_id: 'company',
    });
    expect(save?.arguments.view).not.toHaveProperty('tenant_id');
    const viewReads = calls.filter(({ name }) => name === 'view_get');
    expect(viewReads.at(-1)?.arguments).toEqual({ view_id: 'view:qualified:copy' });
  });
});
