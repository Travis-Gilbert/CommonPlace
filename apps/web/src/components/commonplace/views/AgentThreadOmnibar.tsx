'use client';

import Image from 'next/image';
import type { ChangeEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Plus, Send } from '@/lib/icons';
import { cn } from '@/lib/utils';
import styles from './AgentThreadOmnibar.module.css';

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

interface AgentThreadOmnibarProps {
  busy?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (options: { file?: File }) => void | Promise<void>;
}

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 164;

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = `${minHeight}px`;
      if (reset) return;

      const nextHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      );
      textarea.style.height = `${nextHeight}px`;
    },
    [maxHeight, minHeight],
  );

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export default function AgentThreadOmnibar({
  busy = false,
  placeholder = 'Message Theorem',
  value,
  onChange,
  onSubmit,
}: AgentThreadOmnibarProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
  });

  useEffect(() => {
    adjustHeight(!value);
  }, [adjustHeight, value]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function clearAttachment(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setAttachedFile(undefined);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setAttachedFile(file);
    setImagePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit() {
    if (!value.trim() || busy) return;
    await onSubmit({ file: attachedFile });
    adjustHeight(true);
    clearAttachment();
  }

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <div className={styles.shell}>
          <div className={styles.scrollArea} style={{ maxHeight: `${MAX_HEIGHT}px` }}>
            <div className={styles.inputLayer}>
              <textarea
                ref={textareaRef}
                id="commonplace-agent-input"
                value={value}
                placeholder={placeholder}
                className={styles.textarea}
                rows={1}
                aria-label="Message Theorem"
                disabled={busy}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
                onChange={(event) => {
                  onChange(event.target.value);
                  adjustHeight();
                }}
              />
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.leftTools}>
              <label
                className={cn(styles.iconTool, attachedFile && styles.iconToolActive)}
                title="Attach file"
                aria-label="Attach file"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  disabled={busy}
                />
                <Paperclip size={16} />
                {attachedFile ? (
                  <span className={styles.fileName}>{attachedFile.name}</span>
                ) : null}
                {imagePreview ? (
                  <span className={styles.preview}>
                    <Image
                      src={imagePreview}
                      alt="Attached image preview"
                      fill
                      sizes="100px"
                      unoptimized
                      className={styles.previewImage}
                    />
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className={styles.previewClose}
                      aria-label="Remove attachment"
                      title="Remove attachment"
                    >
                      <Plus size={16} />
                    </button>
                  </span>
                ) : null}
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              className={cn(styles.sendButton, value.trim() && styles.sendButtonActive)}
              aria-label={busy ? 'Sending message' : 'Send message'}
              title="Send message"
              disabled={!value.trim() || busy}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
