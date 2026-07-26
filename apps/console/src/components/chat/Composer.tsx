'use client';

// SOURCING: Claude-style composer anatomy (paper extract + CH5 deletions).
// Register tokens only. No alert(), no colour literals, no Math.random ids,
// no fabricated upload progress, no textarea paste duplication.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { useAssistantTransportSendCommand } from '@assistant-ui/react';
import { cn } from '@/lib/cn';
import {
  isTextualFile,
  newAttachmentId,
  PASTE_CARD_THRESHOLD,
  readFileAsText,
} from '@/lib/chat/file-text';

export interface FileWithPreview {
  readonly id: string;
  readonly file: File;
  readonly preview?: string;
  readonly textPreview?: string;
  /** 0..1 when known; null means indeterminate. */
  progress: number | null;
  status: 'pending' | 'uploading' | 'ready' | 'error';
  error?: string;
  remoteId?: string;
}

export interface PastedContent {
  readonly id: string;
  readonly text: string;
  readonly truncatedLabel: string;
}

export interface ComposerAttachmentHandlers {
  readonly files: readonly FileWithPreview[];
  readonly pastes: readonly PastedContent[];
  readonly addFiles: (files: FileList | File[]) => void;
  readonly replaceFile: (id: string, file: File) => void;
  readonly removeFile: (id: string) => void;
  readonly removePaste: (id: string) => void;
  readonly stageObjectRef: (ref: { id: string; label: string; address?: string }) => void;
  readonly objectRefs: readonly { id: string; label: string; address?: string }[];
  readonly removeObjectRef: (id: string) => void;
}

export interface ChatComposerProps {
  readonly disabled?: boolean;
  readonly unreachable?: boolean;
  readonly modelLabel?: string;
  readonly onModelChange?: (model: string) => void;
  readonly models?: readonly string[];
  readonly attachmentApi?: ComposerAttachmentHandlers;
}

function uploadWithProgress(
  file: File,
  onProgress: (ratio: number | null) => void,
): Promise<{ id: string; name: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/chat/attachments');
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress(null);
        return;
      }
      onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { id: string; name: string };
          resolve(body);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Invalid upload response.'));
        }
        return;
      }
      reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Upload failed: network unreachable.'));
    const form = new FormData();
    form.append('file', file);
    onProgress(null);
    xhr.send(form);
  });
}

export function useChatAttachments(): ComposerAttachmentHandlers {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [pastes, setPastes] = useState<PastedContent[]>([]);
  const [objectRefs, setObjectRefs] = useState<{ id: string; label: string; address?: string }[]>([]);

  const startUpload = useCallback((entry: FileWithPreview) => {
    setFiles((current) =>
      current.map((file) =>
        file.id === entry.id ? { ...file, status: 'uploading', progress: null, error: undefined } : file,
      ),
    );
    void uploadWithProgress(entry.file, (ratio) => {
      setFiles((current) =>
        current.map((file) => (file.id === entry.id ? { ...file, progress: ratio } : file)),
      );
    })
      .then((remote) => {
        setFiles((current) =>
          current.map((file) =>
            file.id === entry.id
              ? { ...file, status: 'ready', progress: 1, remoteId: remote.id }
              : file,
          ),
        );
      })
      .catch((error: unknown) => {
        setFiles((current) =>
          current.map((file) =>
            file.id === entry.id
              ? {
                  ...file,
                  status: 'error',
                  progress: null,
                  error: error instanceof Error ? error.message : 'Upload failed.',
                }
              : file,
          ),
        );
      });
  }, []);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list);
      void (async () => {
        const next: FileWithPreview[] = [];
        for (const file of incoming) {
          const id = newAttachmentId();
          let textPreview: string | undefined;
          if (isTextualFile(file)) {
            try {
              textPreview = (await readFileAsText(file)).slice(0, 4000);
            } catch {
              textPreview = undefined;
            }
          }
          const entry: FileWithPreview = {
            id,
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            textPreview,
            progress: null,
            status: 'pending',
          };
          next.push(entry);
        }
        setFiles((current) => [...current, ...next]);
        for (const entry of next) startUpload(entry);
      })();
    },
    [startUpload],
  );

  const replaceFile = useCallback(
    (id: string, file: File) => {
      const entry: FileWithPreview = {
        id,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        progress: null,
        status: 'pending',
      };
      setFiles((current) => current.map((item) => (item.id === id ? entry : item)));
      startUpload(entry);
    },
    [startUpload],
  );

  return {
    files,
    pastes,
    addFiles,
    replaceFile,
    removeFile: (id) => setFiles((current) => current.filter((file) => file.id !== id)),
    removePaste: (id) => setPastes((current) => current.filter((paste) => paste.id !== id)),
    stageObjectRef: (ref) =>
      setObjectRefs((current) => (current.some((item) => item.id === ref.id) ? current : [...current, ref])),
    objectRefs,
    removeObjectRef: (id) => setObjectRefs((current) => current.filter((ref) => ref.id !== id)),
    // expose setter for paste cards via a side channel on the handlers object
    ...( {
      _setPastes: setPastes,
    } as object),
  };
}

export function ChatComposer({
  disabled = false,
  unreachable = false,
  modelLabel = 'theorem',
  onModelChange,
  models = ['theorem', 'web'],
  attachmentApi,
}: ChatComposerProps) {
  const sendCommand = useAssistantTransportSendCommand();
  const [text, setText] = useState('');
  const [pastes, setPastes] = useState<PastedContent[]>([]);
  const localAttachments = useChatAttachments();
  const attachments = attachmentApi ?? localAttachments;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = '0px';
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [text]);

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipped = event.clipboardData.getData('text');
    if (clipped.length < PASTE_CARD_THRESHOLD) return;
    event.preventDefault();
    // Store the card only; leave the textarea alone (CH5).
    setPastes((current) => [
      ...current,
      {
        id: newAttachmentId(),
        text: clipped,
        truncatedLabel: `${clipped.slice(0, 48).trim()}… (${clipped.length} chars)`,
      },
    ]);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (disabled || unreachable) return;
    const pasteBlock = pastes.map((paste) => paste.text).join('\n\n');
    const refLine = attachments.objectRefs
      .map((ref) => (ref.address ? `@[${ref.label}](${ref.address})` : `@${ref.label}`))
      .join(' ');
    const fileLine = attachments.files
      .filter((file) => file.status === 'ready')
      .map((file) => `attached:${file.remoteId ?? file.id}:${file.file.name}`)
      .join('\n');
    const body = [text.trim(), pasteBlock, refLine, fileLine].filter(Boolean).join('\n\n');
    if (!body) return;
    sendCommand({
      type: 'add-message',
      message: { role: 'user', parts: [{ type: 'text', text: body }] },
      parentId: null,
      sourceId: null,
    } as never);
    setText('');
    setPastes([]);
  };

  const onDropReplace = (event: DragEvent<HTMLDivElement>, targetId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const dropped = event.dataTransfer.files;
    if (!dropped?.length) return;
    if (targetId && dropped[0]) {
      attachments.replaceFile(targetId, dropped[0]);
      return;
    }
    attachments.addFiles(dropped);
  };

  return (
    <form
      data-chat-composer
      onSubmit={submit}
      className="w-full"
      onDragOver={(event) => event.preventDefault()}
    >
      {(attachments.files.length > 0 || pastes.length > 0 || attachments.objectRefs.length > 0) && (
        <div data-attachment-tray className="mb-2 flex flex-wrap gap-2">
          {attachments.objectRefs.map((ref) => (
            <span
              key={ref.id}
              className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-ij-control-border bg-ij-raised px-2 py-1 text-ij-ink"
            >
              @{ref.label}
              <button type="button" aria-label="Remove reference" onClick={() => attachments.removeObjectRef(ref.id)}>
                ×
              </button>
            </span>
          ))}
          {pastes.map((paste) => (
            <span
              key={paste.id}
              className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius-control)] border border-ij-control-border bg-ij-raised px-2 py-1 font-ij-mono text-ij-ink"
            >
              <span className="truncate">{paste.truncatedLabel}</span>
              <button type="button" aria-label="Remove paste" onClick={() => setPastes((c) => c.filter((p) => p.id !== paste.id))}>
                ×
              </button>
            </span>
          ))}
          {attachments.files.map((file) => (
            <div
              key={file.id}
              data-attachment-item
              data-status={file.status}
              className="relative min-w-[10rem] max-w-[16rem] rounded-[var(--radius-control)] border border-ij-control-border bg-ij-raised px-2 py-1"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDropReplace(event, file.id)}
            >
              <div className="flex items-center gap-2 text-ij-ink">
                <span className="truncate">{file.file.name}</span>
                <button type="button" aria-label="Remove attachment" onClick={() => attachments.removeFile(file.id)}>
                  ×
                </button>
              </div>
              {file.textPreview ? (
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-ij-mono text-ij-ink-info">
                  {file.textPreview}
                </pre>
              ) : null}
              {file.status === 'uploading' ? (
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={file.progress == null ? undefined : Math.round(file.progress * 100)}
                  aria-label={file.progress == null ? 'Upload in progress' : undefined}
                  className="mt-1 h-1 overflow-hidden rounded-sm bg-ij-hover-surface"
                >
                  <div
                    className={cn(
                      'h-full bg-ij-accent',
                      file.progress == null && 'w-1/3 animate-pulse',
                    )}
                    style={file.progress == null ? undefined : { width: `${Math.round(file.progress * 100)}%` }}
                  />
                </div>
              ) : null}
              {file.status === 'error' ? (
                <div className="mt-1 flex items-center gap-2 text-[color:var(--hue-status-failed)]">
                  <span className="truncate">{file.error ?? 'Upload failed.'}</span>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => attachments.replaceFile(file.id, file.file)}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[var(--ij-composer-radius)] border border-ij-control-border bg-ij-raised p-2">
        <textarea
          ref={textareaRef}
          data-composer-input
          value={text}
          disabled={disabled || unreachable}
          onChange={(event) => setText(event.target.value)}
          onPaste={onPaste}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={unreachable ? 'Harness unreachable' : 'Message the project…'}
          rows={1}
          className="composer-input min-h-[var(--ij-composer-min-h)] w-full resize-none bg-transparent text-ij-ink outline-none placeholder:text-ij-ink-disabled"
        />
        <div className="composer-controls mt-2 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) attachments.addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            aria-label="Attach file"
            className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || unreachable}
          >
            Attach
          </button>
          <label className="ml-auto flex items-center gap-1 text-ij-ink-info">
            <span className="sr-only">Model</span>
            <select
              className="composer-mode-select h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
              value={modelLabel}
              onChange={(event) => onModelChange?.(event.target.value)}
              disabled={disabled || unreachable}
            >
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            aria-label="Send"
            disabled={disabled || unreachable || (!text.trim() && pastes.length === 0 && attachments.files.every((f) => f.status !== 'ready'))}
            className="composer-send-button h-ij-control rounded-[var(--radius-control)] bg-ij-accent px-3 text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
      {unreachable ? (
        <p className="mt-2 text-ij-ink-info" role="status">
          The harness is unreachable. Sending is paused until reconnect.
        </p>
      ) : null}
    </form>
  );
}

// Keep the CH5 export name the page imports.
export { ChatComposer as Composer };
