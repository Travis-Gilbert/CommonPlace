import { afterEach, describe, expect, it, vi } from 'vitest';
import { prototypeRecordingUrl } from './recordingUrl';

describe('prototypeRecordingUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers an absolute recording_url', () => {
    expect(
      prototypeRecordingUrl({
        recordingId: 'rec-1',
        recordingUrl: 'https://cdn.example/rec.rrd',
        gatewayBase: 'https://gw.example',
      }),
    ).toBe('https://cdn.example/rec.rrd');
  });

  it('composes gateway + recording_id', () => {
    expect(
      prototypeRecordingUrl({
        recordingId: 'rec/with spaces',
        gatewayBase: 'https://gw.example/',
      }),
    ).toBe('https://gw.example/v1/prototype/recordings/rec%2Fwith%20spaces.rrd');
  });

  it('falls back to NEXT_PUBLIC_THEOREM_GATEWAY_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_THEOREM_GATEWAY_URL', 'https://env.example');
    expect(prototypeRecordingUrl({ recordingId: 'abc' })).toBe(
      'https://env.example/v1/prototype/recordings/abc.rrd',
    );
  });

  it('returns null when neither url nor base is available', () => {
    expect(prototypeRecordingUrl({ recordingId: 'abc' })).toBeNull();
  });
});
