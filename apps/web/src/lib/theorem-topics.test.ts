import { describe, expect, it } from 'vitest';
import { topicCapturePreview, topicRecords, unwrapGraphqlField } from './theorem-topics';

describe('theorem topics client', () => {
  it('unwraps MCP GraphQL envelopes and projects topic cards', () => {
    const payload = {
      result: {
        structuredContent: {
          data: {
            topics: {
              topics: [{
                id: 'topic_subscription:Travis-Gilbert:rust-databases',
                labels: ['TopicSubscription', 'Item'],
                properties: {
                  topic_id: 'rust-databases',
                  title: 'Rust databases',
                  body: { body_kind: 'inline', text: 'Track database releases' },
                  status: 'active',
                  cadence: { kind: 'interval', every_seconds: 3600 },
                  document_count: 12,
                  destination_count: 1,
                  last_run_at_ms: 100,
                  next_run_at_ms: 200,
                  updated_at_ms: 150,
                  gate_model_version: 'topic-v3',
                  learning_signal_count: 48,
                  feedback_accept_rate: 0.75,
                  last_training_at_ms: 140,
                  training_precision: 0.82,
                  training_calibration_error: 0.06,
                  training_decision: 'promote',
                  extra: {
                    connector_count: 2,
                    subscription: { name: 'Rust databases', intent: 'Track database releases' },
                  },
                },
              }],
            },
          },
        },
      },
    };

    expect(unwrapGraphqlField(payload, 'topics')).toEqual(payload.result.structuredContent.data.topics);
    expect(topicRecords(payload)).toEqual([expect.objectContaining({
      id: 'rust-databases',
      name: 'Rust databases',
      cadenceSeconds: 3600,
      documentCount: 12,
      connectorCount: 2,
      gateModelVersion: 'topic-v3',
      learningSignalCount: 48,
      trainingPrecision: 0.82,
      trainingDecision: 'promote',
    })]);
  });

  it('drops malformed graph nodes instead of inventing topic identities', () => {
    expect(topicRecords({ data: { topics: { topics: [{ properties: {} }] } } })).toEqual([]);
  });

  it('keeps GitHub OG provenance separate from its held Survey asset', () => {
    const preview = topicCapturePreview({
      source_preview_kind: 'open_graph',
      source_preview_origin_url: 'https://opengraph.githubassets.com/abc/owner/repo',
      source_preview_title: 'owner/repo',
      source_preview_description: 'A GitHub repository',
      source_snapshot_url: '/api/theorem/topic-preview-assets/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      source_snapshot_alt: 'Preview image for owner/repo',
      source_aspect_ratio: 2,
    });

    expect(preview).toMatchObject({
      kind: 'open_graph',
      originUrl: 'https://opengraph.githubassets.com/abc/owner/repo',
      snapshotUrl: '/api/theorem/topic-preview-assets/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      aspectRatio: 2,
    });
    expect(preview?.snapshotUrl).not.toBe(preview?.originUrl);
  });

  it('refuses an unheld remote URL as a Survey render asset', () => {
    const preview = topicCapturePreview({
      source_preview_kind: 'open_graph',
      source_preview_origin_url: 'https://opengraph.githubassets.com/abc/owner/repo',
      source_snapshot_url: 'https://opengraph.githubassets.com/abc/owner/repo',
    });

    expect(preview?.originUrl).toBe('https://opengraph.githubassets.com/abc/owner/repo');
    expect(preview?.snapshotUrl).toBeUndefined();
  });
});
