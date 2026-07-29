export type PetVoiceEngine = 'apple' | 'parakeet' | 'whisper';

export interface PetNativePreferences {
  pinned: boolean;
  clickThrough: boolean;
  quietHours: boolean;
  shortcut: string;
  model: string;
  proxyBaseUrl: string;
  commonplaceApiBase: string;
  threadRetention: number;
  voiceEnabled: boolean;
  voiceEngine: PetVoiceEngine;
  voiceLocale: string;
  captureDictation: boolean;
  captureReadAloud: boolean;
  signatureVoice: 'theorem-hearth' | 'theorem-lantern';
}

export interface PetCaptureCredentialStatus {
  configured: boolean;
}

export interface PetVoiceModelStatus {
  entry: {
    id: string;
    displayName: string;
    tier: 'ears' | 'instant' | 'rich';
    sizeBytes: number;
    contentHash: string;
    license: string;
    installMode: string;
  };
  installed: boolean;
  installedBytes: number;
  reason?: string;
}

interface TauriInternals {
  invoke<T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T>;
}

const PET_COMMAND_PREFIX = 'plugin:theorem-pet|';

function tauriInternals(): TauriInternals | null {
  if (typeof window === 'undefined') return null;
  const internals = (
    window as typeof window & {
      __TAURI_INTERNALS__?: Partial<TauriInternals>;
    }
  ).__TAURI_INTERNALS__;
  return typeof internals?.invoke === 'function'
    ? (internals as TauriInternals)
    : null;
}

export function hasPetNativeBridge(): boolean {
  return tauriInternals() !== null;
}

async function invokePet<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const internals = tauriInternals();
  if (!internals) {
    throw new Error('PET settings require the CommonPlace desktop app');
  }
  return internals.invoke<T>(`${PET_COMMAND_PREFIX}${command}`, args);
}

export function petNativePreferences(): Promise<PetNativePreferences> {
  return invokePet<PetNativePreferences>('native_preferences');
}

export function petUpdatePreferences(
  preferences: PetNativePreferences,
): Promise<PetNativePreferences> {
  return invokePet<PetNativePreferences>('update_pet_preferences', {
    preferences,
  });
}

export function petShow(): Promise<PetNativePreferences> {
  return invokePet<PetNativePreferences>('pet_show');
}

export function petCaptureCredentialStatus(): Promise<PetCaptureCredentialStatus> {
  return invokePet<PetCaptureCredentialStatus>('capture_credential_status');
}

export function petSetCaptureCredential(
  apiKey: string,
): Promise<PetCaptureCredentialStatus> {
  return invokePet<PetCaptureCredentialStatus>('set_capture_credential', {
    apiKey,
  });
}

export function petClearCaptureCredential(): Promise<PetCaptureCredentialStatus> {
  return invokePet<PetCaptureCredentialStatus>('clear_capture_credential');
}

export function petVoiceModels(): Promise<readonly PetVoiceModelStatus[]> {
  return invokePet<PetVoiceModelStatus[]>('voice_model_status');
}

export function petInstallVoiceModel(
  id: string,
): Promise<PetVoiceModelStatus> {
  return invokePet<PetVoiceModelStatus>('voice_model_install', { id });
}

export function petDeleteVoiceModel(
  id: string,
): Promise<PetVoiceModelStatus> {
  return invokePet<PetVoiceModelStatus>('voice_model_delete', { id });
}
