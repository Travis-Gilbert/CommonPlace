// @vitest-environment node
// SOURCING: none. LocalDevMetadataStore stand-in coverage.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  handleLocalDevMetadata,
  resetLocalDevMetadataStore,
} from './local-dev-metadata-store';

describe('LocalDevMetadataStore', () => {
  beforeEach(() => {
    resetLocalDevMetadataStore();
  });

  it('lists seeded objects and promotes an index', async () => {
    const listed = await handleLocalDevMetadata('GET', ['objects'], null);
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as {
      objects: { edges: Array<{ node: { nameSingular: string } }> };
      source: string;
    };
    expect(body.source).toBe('LocalDevMetadataStore');
    expect(body.objects.edges.map((edge) => edge.node.nameSingular)).toEqual(
      expect.arrayContaining(['customer', 'order']),
    );

    const promoted = await handleLocalDevMetadata(
      'POST',
      ['indexes', 'customer', 'email'],
      JSON.stringify({ kind: 'user_marked' }),
    );
    expect(promoted.status).toBe(201);

    const candidates = await handleLocalDevMetadata('GET', ['promotion-candidates'], null);
    const candidateBody = (await candidates.json()) as {
      candidates: Array<{ fieldName: string; objectNameSingular: string }>;
    };
    expect(
      candidateBody.candidates.some(
        (row) => row.objectNameSingular === 'customer' && row.fieldName === 'email',
      ),
    ).toBe(false);

    // Demote (DELETE index)
    const demoted = await handleLocalDevMetadata(
      'DELETE',
      ['indexes', 'customer', 'email'],
      null,
    );
    expect(demoted.status).toBe(204);

    // Verify demotion restores the promotion candidate
    const postDemotedCandidates = await handleLocalDevMetadata('GET', ['promotion-candidates'], null);
    const postDemotedCandidateBody = (await postDemotedCandidates.json()) as {
      candidates: Array<{ fieldName: string; objectNameSingular: string }>;
    };
    expect(
      postDemotedCandidateBody.candidates.some(
        (row) => row.objectNameSingular === 'customer' && row.fieldName === 'email',
      ),
    ).toBe(true);
  });

  it('maps and revokes facet conformance', async () => {
    const created = await handleLocalDevMetadata(
      'POST',
      ['objects', 'customer', 'conformances'],
      JSON.stringify({
        facet: 'publishable',
        propertyMap: { title: 'name' },
      }),
    );
    expect(created.status).toBe(201);

    const detail = await handleLocalDevMetadata('GET', ['objects', 'customer'], null);
    const object = (await detail.json()) as {
      conformances: Array<{ facet: string }>;
    };
    expect(object.conformances[0]?.facet).toBe('publishable');

    const revoked = await handleLocalDevMetadata(
      'DELETE',
      ['objects', 'customer', 'conformances', 'publishable'],
      null,
    );
    expect(revoked.status).toBe(204);
  });

  it('rejects PATCH on system fields with 403', async () => {
    const response = await handleLocalDevMetadata(
      'PATCH',
      ['fields', 'customer', 'id'],
      JSON.stringify({ label: 'Identifier' }),
    );
    expect(response.status).toBe(403);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await handleLocalDevMetadata('GET', ['unknown-junk'], null);
    expect(response.status).toBe(404);
  });
});
