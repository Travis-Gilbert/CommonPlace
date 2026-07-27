'use client';

// SOURCING: none. CH8: one page-level drop overlay. Nested zones are forbidden.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';

export interface ChatDropHandlers {
  readonly onFiles: (files: FileList) => void;
  readonly onObjectRef: (ref: { id: string; label: string; address?: string }) => void;
}

const DropContext = createContext<ChatDropHandlers | null>(null);

export function useChatDropHandlers(): ChatDropHandlers | null {
  return useContext(DropContext);
}

export function ChatDropProvider({
  children,
  onFiles,
  onObjectRef,
}: {
  children: ReactNode;
  onFiles: (files: FileList) => void;
  onObjectRef: (ref: { id: string; label: string; address?: string }) => void;
}) {
  const [active, setActive] = useState(false);
  const depthRef = useRef(0);
  const handlers = useMemo(() => ({ onFiles, onObjectRef }), [onFiles, onObjectRef]);

  const clear = useCallback(() => {
    depthRef.current = 0;
    setActive(false);
  }, []);

  useEffect(() => {
    const onWindowDragEnd = () => clear();
    const onWindowDrop = () => clear();
    window.addEventListener('dragend', onWindowDragEnd);
    window.addEventListener('drop', onWindowDrop);
    // Leaving the window should clear the overlay (CH8).
    const onDragLeaveWindow = (event: DragEvent | Event) => {
      const drag = event as DragEvent;
      if (drag.relatedTarget == null) clear();
    };
    window.addEventListener('dragleave', onDragLeaveWindow as EventListener);
    return () => {
      window.removeEventListener('dragend', onWindowDragEnd);
      window.removeEventListener('drop', onWindowDrop);
      window.removeEventListener('dragleave', onDragLeaveWindow as EventListener);
    };
  }, [clear]);

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    depthRef.current += 1;
    setActive(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setActive(false);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    clear();
    const objectRaw = event.dataTransfer.getData('application/x-commonplace-object');
    if (objectRaw) {
      try {
        const parsed = JSON.parse(objectRaw) as { id: string; label: string; address?: string };
        if (parsed.id && parsed.label) onObjectRef(parsed);
      } catch {
        // Ignore malformed payloads.
      }
      return;
    }
    if (event.dataTransfer.files?.length) onFiles(event.dataTransfer.files);
  };

  return (
    <DropContext.Provider value={handlers}>
      <div
        data-chat-drop-root
        className="relative h-full w-full"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {children}
        {active ? (
          <div
            data-chat-drop-overlay
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-ij-frame/70 text-ij-ink"
            aria-hidden
          >
            Drop to attach
          </div>
        ) : null}
      </div>
    </DropContext.Provider>
  );
}
