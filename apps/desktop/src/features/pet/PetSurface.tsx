import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import runeSprite from "../../assets/pet/rune.png";
import {
  isTauri,
  petCompose,
  petDraft,
  petInsertAtCursor,
  petNativePreferences,
  petSaveDraft,
  petSetComposerFocused,
  petSpeak,
  petStartDragging,
  petVoiceStart,
  petVoiceStop,
  type PetNativePreferences,
  type PetTranscriptEvent,
  type PetVoiceState,
} from "../../lib/commands";
import {
  drainPetCaptureQueue,
  enqueuePetCapture,
  newPetCaptureEnvelope,
} from "./capture";
import "./pet.css";

const DEFAULT_PREFERENCES: PetNativePreferences = {
  pinned: false,
  clickThrough: false,
  quietHours: false,
  shortcut: "CommandOrControl+Shift+Space",
  model: "",
  proxyBaseUrl: "http://127.0.0.1:8484",
  commonplaceApiBase: "http://127.0.0.1:50090",
  threadRetention: 50,
  voiceEnabled: false,
  voiceEngine: "apple",
  voiceLocale: "en-US",
  captureDictation: false,
  captureReadAloud: false,
  signatureVoice: "theorem-hearth",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function insertTranscript(
  value: string,
  transcript: string,
  start: number,
  end: number,
): { value: string; cursor: number } {
  const needsSpace =
    start > 0 && !/\s/.test(value[start - 1]) && !/^[\s,.;:!?]/.test(transcript);
  const insertion = `${needsSpace ? " " : ""}${transcript}`;
  return {
    value: `${value.slice(0, start)}${insertion}${value.slice(end)}`,
    cursor: start + insertion.length,
  };
}

function MicrophoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M8.5 21h7" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 13-7-4.5 14-2.2-5.3L5 12Z" />
      <path d="m11.3 13.7 3.8-4.2" />
    </svg>
  );
}

export function PetSurface() {
  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [preferences, setPreferences] =
    useState<PetNativePreferences>(DEFAULT_PREFERENCES);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready when you are.");
  const [voiceState, setVoiceState] = useState<PetVoiceState>("idle");
  const [dropActive, setDropActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftHydratedRef = useRef(false);
  const preferencesRef = useRef(preferences);
  const voiceModeRef = useRef<"push" | "latch">("latch");

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    void Promise.all([petNativePreferences(), petDraft()])
      .then(([nextPreferences, savedDraft]) => {
        setPreferences(nextPreferences);
        setDraft(savedDraft);
      })
      .catch((error) => setStatus(errorMessage(error)))
      .finally(() => {
        draftHydratedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    const timer = window.setTimeout(() => {
      void petSaveDraft(draft);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 88)}px`;
  }, [draft]);

  useEffect(() => {
    const drain = (): void => {
      void drainPetCaptureQueue().catch(() => {
        setStatus("A capture is safe in the queue and will retry.");
      });
    };
    drain();
    window.addEventListener("online", drain);
    return () => window.removeEventListener("online", drain);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unlisten = getCurrentWebviewWindow().onDragDropEvent(({ payload }) => {
      if (payload.type === "enter" || payload.type === "over") {
        setDropActive(true);
        return;
      }
      setDropActive(false);
      if (payload.type !== "drop" || payload.paths.length === 0) return;
      const count = payload.paths.length;
      void enqueuePetCapture(
        newPetCaptureEnvelope({
          body: "",
          object_type: "file",
          capture_method: "dropped",
          local_file_paths: payload.paths,
        }),
      )
        .then((entry) => {
          if (disposed) return;
          setStatus(
            entry.state === "sent"
              ? `Filed ${count} dropped file${count === 1 ? "" : "s"}.`
              : "Dropped files are safe in the CommonPlace queue.",
          );
        })
        .catch((error) => {
          if (!disposed) setStatus(`Capture failed: ${errorMessage(error)}`);
        });
    });
    return () => {
      disposed = true;
      void unlisten.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const listeners = [
      listen<PetNativePreferences>(
        "pet:native-preferences",
        ({ payload }) => setPreferences(payload),
      ),
      listen<{ selectDraft?: boolean }>(
        "pet:focus-composer",
        ({ payload }) => {
          window.requestAnimationFrame(() => {
            textareaRef.current?.focus();
            if (payload.selectDraft) textareaRef.current?.select();
          });
        },
      ),
      listen<PetTranscriptEvent>("pet:voice-event", ({ payload }) => {
        if (payload.event === "partial") {
          setVoiceState("processing");
          setStatus(payload.payload.text || "Listening…");
          return;
        }
        if (payload.event === "error") {
          setVoiceState("error");
          setStatus(payload.payload.message ?? "Voice transcription failed.");
          return;
        }
        const transcript = payload.payload.text.trim();
        setVoiceState(voiceModeRef.current === "latch" ? "listening" : "idle");
        if (!transcript) return;
        setStatus(transcript);
        const textarea = textareaRef.current;
        if (textarea && document.activeElement === textarea) {
          const inserted = insertTranscript(
            textarea.value,
            transcript,
            textarea.selectionStart,
            textarea.selectionEnd,
          );
          setDraft(inserted.value);
          window.requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(inserted.cursor, inserted.cursor);
          });
        } else {
          void petInsertAtCursor(
            transcript,
            voiceModeRef.current === "latch" ? "live" : "batch",
          ).then((result) => {
            if (!result.inserted) {
              setStatus(
                result.reason === "accessibility_permission_required"
                  ? "Transcript ready. Cross-app insertion needs Accessibility permission."
                  : "Transcript ready in CommonPlace.",
              );
            }
          });
        }
        if (preferencesRef.current.captureDictation) {
          void enqueuePetCapture(
            newPetCaptureEnvelope({
              title: transcript.slice(0, 120),
              body: transcript,
              object_type: "note",
              capture_method: "voice",
              properties: { engine: payload.payload.engine },
            }),
          ).catch((error) => {
            setStatus(
              `Transcript inserted, but capture filing failed: ${errorMessage(error)}`,
            );
          });
        }
      }),
      listen<{ state: PetVoiceState; mode: "push" }>(
        "pet:voice-shortcut",
        ({ payload }) => {
          voiceModeRef.current = payload.mode;
          setVoiceState(payload.state);
          if (payload.state === "listening") {
            setStatus("Listening while you hold the composer shortcut.");
          }
        },
      ),
      listen<{
        action: "dictate" | "read_aloud" | "capture_selection";
        text?: string;
      }>("pet:selection-act", ({ payload }) => {
        if (payload.action === "dictate") {
          voiceModeRef.current = "latch";
          setVoiceState("listening");
          setStatus("Listening from the macOS Dictate Here service.");
          void petVoiceStart(
            preferencesRef.current.voiceEngine,
            preferencesRef.current.voiceLocale,
            "latch",
          ).catch((error) => {
            setVoiceState("error");
            setStatus(`Dictation unavailable: ${errorMessage(error)}`);
          });
          return;
        }
        if (!payload.text) {
          setStatus("The macOS service did not receive selected text.");
          return;
        }
        if (payload.action === "read_aloud") {
          setVoiceState("speaking");
          setStatus("Reading your selection aloud.");
          void petSpeak(
            payload.text,
            preferencesRef.current.signatureVoice,
            "instant",
          ).catch((error) => {
            setVoiceState("error");
            setStatus(`Read-aloud unavailable: ${errorMessage(error)}`);
          });
          return;
        }
        void enqueuePetCapture(
          newPetCaptureEnvelope({
            title: payload.text.slice(0, 120),
            body: payload.text,
            object_type: "note",
            capture_method: "selected",
          }),
        )
          .then(() => setStatus("Selection filed in CommonPlace."))
          .catch((error) =>
            setStatus(`Selection capture failed: ${errorMessage(error)}`),
          );
      }),
      listen("pet:stood-down", () => {
        setBusy(false);
        setVoiceState("idle");
      }),
    ];
    return () => {
      for (const unlisten of listeners) {
        void unlisten.then((stop) => stop());
      }
    };
  }, []);

  const submit = async (): Promise<void> => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setStatus("Thinking…");
    try {
      const response = await petCompose(text, threadId);
      setThreadId(response.threadId);
      setStatus(response.reply);
      if (!response.source.retryable) {
        setDraft("");
        await petSaveDraft("");
      }
    } catch (error) {
      setStatus(`Still here. ${errorMessage(error)}`);
    } finally {
      setBusy(false);
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const toggleVoice = async (): Promise<void> => {
    if (voiceState === "listening" || voiceState === "processing") {
      setVoiceState("processing");
      setStatus("Finishing transcription…");
      try {
        await petVoiceStop();
        setVoiceState("idle");
      } catch (error) {
        setVoiceState("error");
        setStatus(`Could not stop dictation: ${errorMessage(error)}`);
      }
      return;
    }
    voiceModeRef.current = "latch";
    setVoiceState("listening");
    setStatus("Listening…");
    try {
      await petVoiceStart(
        preferences.voiceEngine,
        preferences.voiceLocale,
        "latch",
      );
    } catch (error) {
      setVoiceState("error");
      setStatus(`Dictation unavailable: ${errorMessage(error)}`);
    }
  };

  const onComposerKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      void petSaveDraft(draft);
      textareaRef.current?.blur();
    }
  };

  const onTextDrop = (event: DragEvent<HTMLElement>): void => {
    const text =
      event.dataTransfer.getData("text/plain") ||
      event.dataTransfer.getData("text/uri-list");
    if (!text.trim()) return;
    event.preventDefault();
    setDropActive(false);
    void enqueuePetCapture(
      newPetCaptureEnvelope({
        title: text.trim().slice(0, 120),
        body: text.trim(),
        object_type: "note",
        capture_method: "dropped",
      }),
    )
      .then((entry) =>
        setStatus(
          entry.state === "sent"
            ? "Dropped text filed in CommonPlace."
            : "Dropped text is safe in the CommonPlace queue.",
        ),
      )
      .catch((error) => setStatus(`Capture failed: ${errorMessage(error)}`));
  };

  return (
    <main
      className={`pet-extension voice-${voiceState}${dropActive ? " drop-active" : ""}`}
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes("text/plain") ||
          event.dataTransfer.types.includes("text/uri-list")
        ) {
          event.preventDefault();
          setDropActive(true);
        }
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={onTextDrop}
    >
      <div
        className="pet-drag-surface"
        data-tauri-drag-region
        aria-label="Drag the CommonPlace pet"
        onPointerDown={() => void petStartDragging()}
      >
        <span
          className="pet-sprite"
          style={{ backgroundImage: `url(${runeSprite})` }}
          aria-hidden="true"
        />
      </div>

      <section className="pet-composer" aria-label="CommonPlace pet composer">
        <div className="pet-composer-row">
          <button
            type="button"
            className="pet-icon-button pet-mic-button"
            aria-label={
              voiceState === "listening"
                ? "Stop dictation"
                : "Start local dictation"
            }
            aria-pressed={
              voiceState === "listening" || voiceState === "processing"
            }
            onClick={() => void toggleVoice()}
          >
            <MicrophoneIcon />
          </button>
          <textarea
            ref={textareaRef}
            value={draft}
            rows={1}
            placeholder="Ask CommonPlace…"
            aria-label="Message CommonPlace"
            readOnly={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onComposerKeyDown}
            onFocus={() => void petSetComposerFocused(true)}
            onBlur={() => void petSetComposerFocused(false)}
          />
          <button
            type="button"
            className="pet-icon-button pet-send-button"
            aria-label="Send message"
            disabled={busy || !draft.trim()}
            onClick={() => void submit()}
          >
            <SendIcon />
          </button>
        </div>
        <p className="pet-status" aria-live="polite">
          {status}
        </p>
      </section>
    </main>
  );
}
