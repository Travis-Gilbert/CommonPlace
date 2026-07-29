'use client';

// SOURCING: CommonPlace fork settings structure plus the Tauri PET command
// adapter. The panel uses existing ForkPanel, ForkField, ForkNotice, and Button
// primitives so it stays inside the Console component ledger.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ForkField,
  ForkNotice,
  ForkPanel,
} from '@/components/fork/ForkPageFrame';
import {
  hasPetNativeBridge,
  petCaptureCredentialStatus,
  petClearCaptureCredential,
  petDeleteVoiceModel,
  petInstallVoiceModel,
  petNativePreferences,
  petSetCaptureCredential,
  petShow,
  petUpdatePreferences,
  petVoiceModels,
  type PetNativePreferences,
  type PetVoiceModelStatus,
} from '@/lib/pet-native';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function modelSize(sizeBytes: number): string {
  return `${Math.round(sizeBytes / 1_000_000)} MB`;
}

function PetCheckbox({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange(checked: boolean): void;
}) {
  return (
    <label className="flex min-h-ij-control items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      {label}
    </label>
  );
}

export function PetSettingsPanel() {
  const [available, setAvailable] = useState(false);
  const [preferences, setPreferences] =
    useState<PetNativePreferences | null>(null);
  const persistedPreferences = useRef<PetNativePreferences | null>(null);
  const [credentialConfigured, setCredentialConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] =
    useState<readonly PetVoiceModelStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [message, setMessage] = useState(
    'Open this page in CommonPlace desktop to manage PET.',
  );

  useEffect(() => {
    if (!hasPetNativeBridge()) return;
    let cancelled = false;
    void Promise.allSettled([
      petNativePreferences(),
      petCaptureCredentialStatus(),
      petVoiceModels(),
    ]).then(([nextPreferences, credential, nextModels]) => {
      if (cancelled) return;
      setAvailable(true);
      const failures: unknown[] = [];
      if (nextPreferences.status === 'fulfilled') {
        persistedPreferences.current = nextPreferences.value;
        setPreferences(nextPreferences.value);
      } else {
        failures.push(nextPreferences.reason);
      }
      if (credential.status === 'fulfilled') {
        setCredentialConfigured(credential.value.configured);
      } else {
        failures.push(credential.reason);
      }
      if (nextModels.status === 'fulfilled') {
        setModels(nextModels.value);
      } else {
        failures.push(nextModels.reason);
      }
      setMessage(
        failures.length === 0
          ? 'PET settings are stored by CommonPlace.'
          : `Some PET settings are unavailable: ${failures
              .map(errorMessage)
              .join('; ')}`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (
    patch: Partial<PetNativePreferences>,
  ): Promise<void> => {
    if (!preferences || busy) return;
    const previous = persistedPreferences.current ?? preferences;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setBusy(true);
    setMessage('Saving PET settings...');
    try {
      const saved = await petUpdatePreferences(next);
      persistedPreferences.current = saved;
      setPreferences(saved);
      setMessage('PET settings saved.');
    } catch (error) {
      setPreferences(previous);
      setMessage(`PET settings failed: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const refreshModels = async (): Promise<void> => {
    setModels(await petVoiceModels());
  };

  return (
    <ForkPanel
      title="Desktop PET"
      description="The PET is a frameless extension of CommonPlace. Its window contains only the current creature and composer."
    >
      {!available ? (
        <ForkNotice>
          PET controls appear here when this exact v2 page runs inside
          CommonPlace desktop.
        </ForkNotice>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBusy(true);
                setMessage('Opening PET...');
                void petShow()
                  .then((next) => {
                    persistedPreferences.current = next;
                    setPreferences(next);
                    setMessage('PET is ready for input.');
                  })
                  .catch((error) =>
                    setMessage(`PET could not open: ${errorMessage(error)}`),
                  )
                  .finally(() => setBusy(false));
              }}
              disabled={busy}
            >
              Show PET
            </Button>
          </div>

          {preferences ? (
            <fieldset
              className="grid gap-4 disabled:opacity-60"
              disabled={busy}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <PetCheckbox
                  checked={preferences.pinned}
                  label="Keep PET above other windows"
                  onCheckedChange={(checked) =>
                    void persist({ pinned: checked })
                  }
                />
                <PetCheckbox
                  checked={preferences.clickThrough}
                  label="Let clicks pass through PET"
                  onCheckedChange={(checked) =>
                    void persist({ clickThrough: checked })
                  }
                />
                <PetCheckbox
                  checked={preferences.quietHours}
                  label="Quiet hours"
                  onCheckedChange={(checked) =>
                    void persist({ quietHours: checked })
                  }
                />
                <PetCheckbox
                  checked={preferences.voiceEnabled}
                  label="Local voice"
                  onCheckedChange={(checked) =>
                    void persist({ voiceEnabled: checked })
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ForkField
                  label="Composer shortcut"
                  value={preferences.shortcut}
                  onChange={(event) =>
                    setPreferences({
                      ...preferences,
                      shortcut: event.currentTarget.value,
                    })
                  }
                  onBlur={() => void persist({ shortcut: preferences.shortcut })}
                />
                <ForkField
                  label="Composer model"
                  hint="Uses THEOREM_PET_MODEL when blank."
                  value={preferences.model}
                  onChange={(event) =>
                    setPreferences({
                      ...preferences,
                      model: event.currentTarget.value,
                    })
                  }
                  onBlur={() => void persist({ model: preferences.model })}
                />
                <label className="grid gap-1">
                  <span style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                    Speech engine
                  </span>
                  <Select
                    value={preferences.voiceEngine}
                    onValueChange={(value) =>
                      void persist({
                        voiceEngine:
                          value as PetNativePreferences['voiceEngine'],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apple">Apple on-device</SelectItem>
                      <SelectItem value="parakeet">
                        Parakeet local model
                      </SelectItem>
                      <SelectItem value="whisper">
                        Whisper local model
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <ForkField
                  label="Speech locale"
                  value={preferences.voiceLocale}
                  onChange={(event) =>
                    setPreferences({
                      ...preferences,
                      voiceLocale: event.currentTarget.value,
                    })
                  }
                  onBlur={() =>
                    void persist({ voiceLocale: preferences.voiceLocale })
                  }
                />
                <label className="grid gap-1">
                  <span style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                    Signature voice
                  </span>
                  <Select
                    value={preferences.signatureVoice}
                    onValueChange={(value) =>
                      void persist({
                        signatureVoice:
                          value as PetNativePreferences['signatureVoice'],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="theorem-hearth">Hearth</SelectItem>
                      <SelectItem value="theorem-lantern">Lantern</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <ForkField
                  label="Capture API base"
                  value={preferences.commonplaceApiBase}
                  onChange={(event) =>
                    setPreferences({
                      ...preferences,
                      commonplaceApiBase: event.currentTarget.value,
                    })
                  }
                  onBlur={() =>
                    void persist({
                      commonplaceApiBase: preferences.commonplaceApiBase,
                    })
                  }
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <PetCheckbox
                  checked={preferences.captureDictation}
                  label="File kept dictation in CommonPlace"
                  onCheckedChange={(checked) =>
                    void persist({ captureDictation: checked })
                  }
                />
                <PetCheckbox
                  checked={preferences.captureReadAloud}
                  label="File kept read-aloud text"
                  onCheckedChange={(checked) =>
                    void persist({ captureReadAloud: checked })
                  }
                />
              </div>
              <ForkNotice>
                In-PET dictation works without Accessibility permission.
                Cross-app insertion and read-aloud explain the missing grant
                and never request it automatically. Rich-tier output keeps the
                PerTh provenance watermark. Hearth and Lantern recipe metadata
                is not yet published by the native engine manifest.
              </ForkNotice>
            </fieldset>
          ) : null}

          <div className="grid gap-3 border-t border-ij-seam pt-4">
            <ForkField
              label="Capture API credential"
              hint={
                credentialConfigured
                  ? 'Stored in Keychain.'
                  : 'Not configured.'
              }
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.currentTarget.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || !apiKey.trim()}
                onClick={() => {
                  setBusy(true);
                  setMessage('Saving credential to Keychain...');
                  void petSetCaptureCredential(apiKey)
                    .then((credential) => {
                      setCredentialConfigured(credential.configured);
                      setApiKey('');
                      setMessage('Capture credential stored in Keychain.');
                    })
                    .catch((error) =>
                      setMessage(`Credential failed: ${errorMessage(error)}`),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Save credential
              </Button>
              {credentialConfigured ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void petClearCaptureCredential()
                      .then((credential) => {
                        setCredentialConfigured(credential.configured);
                        setMessage('Capture credential removed.');
                      })
                      .catch((error) =>
                        setMessage(
                          `Credential removal failed: ${errorMessage(error)}`,
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Remove credential
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 border-t border-ij-seam pt-4">
            <h3 style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              Local voice assets
            </h3>
            {models.length === 0 ? (
              <p className="text-ij-ink-info">
                No voice assets are reported by the native model manifest.
              </p>
            ) : (
              models.map((model) => (
                <div
                  key={model.entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-ij-arc border border-ij-seam bg-ij-raised p-3"
                >
                  <span className="grid gap-1">
                    <strong>{model.entry.displayName}</strong>
                    <small className="text-ij-ink-info">
                      {model.entry.tier}, {modelSize(model.entry.sizeBytes)},{' '}
                      {model.entry.license}
                    </small>
                    {model.reason ? (
                      <small className="text-ij-ink-info">
                        {model.reason}
                      </small>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={activeModel !== null}
                    onClick={() => {
                      setActiveModel(model.entry.id);
                      setMessage(
                        `${model.installed ? 'Removing' : 'Installing'} ${model.entry.displayName}...`,
                      );
                      const operation = model.installed
                        ? petDeleteVoiceModel(model.entry.id)
                        : petInstallVoiceModel(model.entry.id);
                      void operation
                        .then(refreshModels)
                        .then(() => setMessage('Voice assets updated.'))
                        .catch((error) =>
                          setMessage(
                            `Voice asset failed: ${errorMessage(error)}`,
                          ),
                        )
                        .finally(() => setActiveModel(null));
                    }}
                  >
                    {activeModel === model.entry.id
                      ? 'Working...'
                      : model.installed
                        ? 'Remove'
                        : 'Install'}
                  </Button>
                </div>
              ))
            )}
          </div>

          <p className="text-ij-ink-info" aria-live="polite">
            {message}
          </p>
        </>
      )}
    </ForkPanel>
  );
}
