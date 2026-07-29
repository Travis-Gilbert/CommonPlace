import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasPetNativeBridge,
  petShow,
  petUpdatePreferences,
  type PetNativePreferences,
} from './pet-native';

const preferences: PetNativePreferences = {
  pinned: false,
  clickThrough: false,
  quietHours: false,
  shortcut: 'CommandOrControl+Shift+Space',
  model: '',
  proxyBaseUrl: 'http://127.0.0.1:8484',
  commonplaceApiBase: 'http://127.0.0.1:50090',
  threadRetention: 50,
  voiceEnabled: false,
  voiceEngine: 'apple',
  voiceLocale: 'en-US',
  captureDictation: false,
  captureReadAloud: false,
  signatureVoice: 'theorem-hearth',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PET native bridge', () => {
  it('refuses native commands outside CommonPlace desktop', async () => {
    vi.stubGlobal('window', {});
    expect(hasPetNativeBridge()).toBe(false);
    await expect(petShow()).rejects.toThrow(
      'PET settings require the CommonPlace desktop app',
    );
  });

  it('uses the namespaced theorem-pet command contract', async () => {
    const invoke = vi.fn(async () => preferences);
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: { invoke },
    });

    expect(hasPetNativeBridge()).toBe(true);
    await petUpdatePreferences(preferences);
    expect(invoke).toHaveBeenCalledWith(
      'plugin:theorem-pet|update_pet_preferences',
      { preferences },
    );
  });
});
