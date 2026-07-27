import { describe, expect, it } from 'vitest';
import {
  canMountConsole,
  FixturePluginController,
  normalizePluginStatus,
} from './plugin';

describe('console plugin lifecycle', () => {
  it('mounts only after explicit corpus-read consent and unmounts on uninstall', () => {
    const controller = new FixturePluginController();
    expect(canMountConsole(controller.status())).toBe(false);

    expect(controller.requestConsent().state).toBe('pending_consent');
    expect(canMountConsole(controller.status())).toBe(false);

    expect(canMountConsole(controller.consent())).toBe(true);
    expect(controller.status().grants).toEqual(['corpus:read']);

    expect(controller.uninstall().state).toBe('available');
    expect(canMountConsole(controller.status())).toBe(false);
  });

  it('normalizes unknown server payloads to typed unavailable state', () => {
    expect(normalizePluginStatus(null)).toMatchObject({
      state: 'unavailable',
      reason: 'plugin_state_unavailable',
    });
    expect(normalizePluginStatus({ state: 'future_state' })).toMatchObject({
      state: 'unavailable',
      reason: 'plugin_state_invalid',
    });
  });
});
