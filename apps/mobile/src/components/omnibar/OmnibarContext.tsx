import React, { createContext, useCallback, useContext, useState } from 'react';

export type OmnibarPrefill = {
  text?: string;
  title?: string;
  kindHint?: string;
  attachmentUri?: string;
  attachmentMime?: string;
  source?: 'omnibar' | 'share' | 'voice' | 'camera' | 'file' | 'web' | 'paste';
};

type OmnibarState = {
  visible: boolean;
  voiceMode: boolean;
  prefill: OmnibarPrefill | null;
};

const OmnibarContext = createContext<{
  state: OmnibarState;
  open: (opts?: { prefill?: OmnibarPrefill; voice?: boolean }) => void;
  close: () => void;
} | null>(null);

export function OmnibarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OmnibarState>({ visible: false, voiceMode: false, prefill: null });
  const open = useCallback((opts?: { prefill?: OmnibarPrefill; voice?: boolean }) => {
    setState({ visible: true, voiceMode: opts?.voice ?? false, prefill: opts?.prefill ?? null });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, visible: false, voiceMode: false, prefill: null })), []);
  return <OmnibarContext.Provider value={{ state, open, close }}>{children}</OmnibarContext.Provider>;
}

export function useOmnibar() {
  const ctx = useContext(OmnibarContext);
  if (!ctx) throw new Error('useOmnibar outside OmnibarProvider');
  return ctx;
}
