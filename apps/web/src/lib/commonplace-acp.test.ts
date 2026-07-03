import { describe, expect, it } from 'vitest';
import { SCENE_PACKAGE_V2_FIXTURE } from '@/lib/scene-package';
import { sceneFromAcpUpdate } from './commonplace-acp';

describe('sceneFromAcpUpdate', () => {
  it('extracts render_scene raw_output from ACP tool-call updates', () => {
    const payload = {
      type: 'scene_package',
      tool: 'render_scene',
      scene_package: SCENE_PACKAGE_V2_FIXTURE,
      fallback_summary: 'Plain text fallback',
      validation: { ok: true },
    };
    const update = {
      sessionUpdate: {
        toolCallUpdate: {
          fields: {
            status: 'completed',
            rawOutput: payload,
          },
        },
      },
    };

    expect(sceneFromAcpUpdate(update)).toEqual(payload);
  });

  it('ignores ordinary text updates', () => {
    expect(sceneFromAcpUpdate({ text: 'hello' })).toBeNull();
  });
});
