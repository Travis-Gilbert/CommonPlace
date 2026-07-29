// @vitest-environment jsdom
// SOURCING: vitest + react-dom: native-confirmed PET settings rollback.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PetNativePreferences } from '@/lib/pet-native';
import { PetSettingsPanel } from './PetSettingsPanel';

const native = vi.hoisted(() => ({
  update: vi.fn(),
  preferences: vi.fn(),
}));

vi.mock('@/lib/pet-native', () => ({
  hasPetNativeBridge: () => true,
  petCaptureCredentialStatus: vi.fn(async () => ({ configured: false })),
  petClearCaptureCredential: vi.fn(),
  petDeleteVoiceModel: vi.fn(),
  petInstallVoiceModel: vi.fn(),
  petNativePreferences: native.preferences,
  petSetCaptureCredential: vi.fn(),
  petShow: vi.fn(),
  petUpdatePreferences: native.update,
  petVoiceModels: vi.fn(async () => []),
}));

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

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  native.preferences.mockResolvedValue(preferences);
  native.update.mockRejectedValue(new Error('native save rejected'));
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe('PetSettingsPanel', () => {
  it('restores the last native-confirmed text value after a failed save', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<PetSettingsPanel />);
      await Promise.resolve();
    });

    const shortcut = Array.from(container.querySelectorAll('input')).find(
      (input) => input.value === preferences.shortcut,
    );
    expect(shortcut).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(shortcut, 'CommandOrControl+Shift+P');
      shortcut?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(shortcut?.value).toBe('CommandOrControl+Shift+P');

    await act(async () => {
      shortcut?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await Promise.resolve();
    });

    expect(native.update).toHaveBeenCalledWith({
      ...preferences,
      shortcut: 'CommandOrControl+Shift+P',
    });
    expect(shortcut?.value).toBe(preferences.shortcut);
    expect(container.textContent).toContain(
      'PET settings failed: native save rejected',
    );
  });
});
