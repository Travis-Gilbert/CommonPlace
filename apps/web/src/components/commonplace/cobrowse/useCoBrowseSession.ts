'use client';

/**
 * Co-browse session state machine (HANDOFF-COBROWSE-PRESENCE D2/D3/D4/D5/D6).
 *
 * Choreography against the engine contract (rustyred-thg browse-with-me):
 * the agent head proposes actions by calling the route with an action and no
 * confirm; the engine HOLDS the action on the session (`preview_pending`).
 * This surface polls the same run_id, telegraphs the held action (highlight
 * plus the node-resolved intent line), then either auto-confirms after the
 * telegraph dwell (Watch/Pair, non-gated verbs) or raises the approval card
 * (write verbs, needs_confirmation). Decline maps to the engine's veto branch,
 * which clears the held action and leaves the session alive, so the agent
 * reads the veto as context instead of terminating.
 *
 * Pause semantics (D4): pausing stops polling and withholds confirm. An
 * in-flight atomic confirm completes; the NEXT held action stays held
 * server-side (the sidecar contract keeps `pending_action` on the session
 * until confirm or veto), so there is never half-applied state to unwind.
 * Resume re-telegraphs the held action and continues.
 *
 * Interrupt detection: the shell emits `cobrowse://stage-focus` when a tab
 * window gains OS focus. External-URL webviews cannot report in-page
 * keystrokes, but the first click or keystroke into the stage necessarily
 * focuses its window, so focus transition IS the input signal.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  agentTabIngest,
  browseWithMe,
  extractVisibleText,
  isTauri,
  listenDesktopEvent,
  proposedActionOf,
  tabClearHighlight,
  tabCreate,
  tabHighlight,
  tabNavigate,
  tabSetActive,
  type AgentIngestionReceipt,
  type BrowsePerception,
  type CoBrowseControlMode,
  type ProposedAction,
} from '@/lib/desktop';
import { viewState, type ViewState } from '@/lib/commonplace-view-state';
import { appendEvent } from '@/lib/carry/bundle-store';

export type CoBrowseMode = 'watch' | 'pair' | 'drive';

/** UI mode to engine control mode (D2's named mapping). */
export const MODE_TO_CONTROL: Record<CoBrowseMode, CoBrowseControlMode> = {
  watch: 'agent_drive',
  pair: 'pair',
  drive: 'human_drive',
};

/** Telegraph dwell before a non-gated action fires (D3): Watch > Pair. */
export const TELEGRAPH_DWELL_MS: Record<CoBrowseMode, number> = {
  watch: 1600,
  pair: 700,
  drive: Number.POSITIVE_INFINITY,
};

const POLL_MS: Record<CoBrowseMode, number> = { watch: 1500, pair: 2500, drive: 0 };

export type RailEntryKind =
  | 'intent'
  | 'action'
  | 'approval'
  | 'decline'
  | 'capture'
  | 'navigation'
  | 'pause';

export interface RailEntry {
  id: string;
  at: number;
  kind: RailEntryKind;
  summary: string;
  /** Full receipt payload, rendered when the entry expands (D6). */
  receipt?: unknown;
}

export interface CoBrowseSession {
  mode: CoBrowseMode;
  setMode: (mode: CoBrowseMode) => void;
  running: boolean;
  paused: boolean;
  tabId: string | null;
  perception: ViewState<BrowsePerception>;
  /** Confirm-gated proposal awaiting the approval card (D5). */
  approval: ProposedAction | null;
  /** The active telegraph intent line, when a held action is being telegraphed. */
  telegraphIntent: string | null;
  entries: RailEntry[];
  keepReceipt: AgentIngestionReceipt | null;
  /** The co-browse session id, shared with the carry bundle (HANDOFF-CARRY). */
  sessionId: string | null;
  error: string | null;
  begin: (url: string, task: string) => Promise<void>;
  approve: () => Promise<void>;
  decline: () => Promise<void>;
  resume: () => void;
  keep: () => Promise<void>;
  dismissKeep: () => void;
  /** One-press "Do it" for the suggested rail action (routes via D5 when gated). */
  runSuggested: () => Promise<void>;
}

function entryId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const MODE_STORAGE_KEY = 'cp-cobrowse-mode';

function initialMode(): CoBrowseMode {
  if (typeof window === 'undefined') return 'pair';
  const stored = window.sessionStorage.getItem(MODE_STORAGE_KEY);
  return stored === 'watch' || stored === 'pair' || stored === 'drive' ? stored : 'pair';
}

export function useCoBrowseSession(): CoBrowseSession {
  const [mode, setModeState] = useState<CoBrowseMode>(initialMode);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tabId, setTabId] = useState<string | null>(null);
  const [perception, setPerception] = useState<ViewState<BrowsePerception>>(viewState.empty());
  const [approval, setApproval] = useState<ProposedAction | null>(null);
  const [telegraphIntent, setTelegraphIntent] = useState<string | null>(null);
  const [entries, setEntries] = useState<RailEntry[]>([]);
  const [keepReceipt, setKeepReceipt] = useState<AgentIngestionReceipt | null>(null);
  // The co-browse session id, shared with the carry bundle (HANDOFF-CARRY D1/D5).
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runIdRef = useRef<string | null>(null);
  const tabIdRef = useRef<string | null>(null);
  const modeRef = useRef(mode);
  const pausedRef = useRef(false);
  const runningRef = useRef(false);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telegraphedRef = useRef<string | null>(null);
  // Self-referencing callbacks (poll reschedules itself, the error state's
  // retry re-runs begin) go through refs so the definitions stay acyclic.
  const pollRef = useRef<() => Promise<void>>(async () => undefined);
  const beginRef = useRef<(url: string, task: string) => Promise<void>>(async () => undefined);

  const pushEntry = useCallback((kind: RailEntryKind, summary: string, receipt?: unknown) => {
    setEntries((prev) => [...prev, { id: entryId(), at: Date.now(), kind, summary, receipt }]);
  }, []);

  const setMode = useCallback((next: CoBrowseMode) => {
    modeRef.current = next;
    setModeState(next);
    if (typeof window !== 'undefined') window.sessionStorage.setItem(MODE_STORAGE_KEY, next);
  }, []);

  const clearTimers = useCallback(() => {
    if (dwellTimer.current) {
      clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const clearTelegraph = useCallback(() => {
    setTelegraphIntent(null);
    telegraphedRef.current = null;
    const tab = tabIdRef.current;
    if (tab) void tabClearHighlight(tab).catch(() => undefined);
  }, []);

  /** Confirm the engine-held action (the dwell or the approval card landed). */
  const confirmHeld = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    try {
      const result = await browseWithMe({
        runId,
        controlMode: MODE_TO_CONTROL[modeRef.current],
        confirm: true,
      });
      // A newer run may have started while the confirm was in flight; never
      // apply a confirmation that no longer belongs to the captured run.
      if (runIdRef.current !== runId) return;
      setPerception(viewState.success(result));
      const intent = result.live_browser?.intent;
      pushEntry('action', intent || 'Applied the held action', result.live_browser);
    } catch (err) {
      setError(String(err));
    } finally {
      clearTelegraph();
      setApproval(null);
    }
  }, [pushEntry, clearTelegraph]);

  /** Telegraph a newly held action: highlight, intent line, then dwell or card. */
  const telegraph = useCallback(
    (result: BrowsePerception) => {
      const proposal = proposedActionOf(result);
      if (!proposal) return;
      const live = result.live_browser;
      const key = `${result.run_id}:${JSON.stringify(proposal.raw)}`;
      if (telegraphedRef.current === key) return;
      telegraphedRef.current = key;

      setTelegraphIntent(proposal.intent || `About to ${proposal.verb} ${proposal.targetDescriptor}`);
      pushEntry('intent', proposal.intent || `Proposing ${proposal.verb} on ${proposal.targetDescriptor}`);

      const tab = tabIdRef.current;
      const elementId =
        typeof proposal.raw.selector === 'string'
          ? proposal.raw.selector
          : proposal.raw.selector.element_id;
      const bbox = live?.page.interactive_elements.find((el) => el.element_id === elementId)?.bbox;
      if (tab && bbox) {
        void tabHighlight(tab, bbox, proposal.intent).catch(() => undefined);
      }

      if (proposal.confirm) {
        setApproval(proposal);
        return;
      }
      if (modeRef.current === 'drive' || pausedRef.current) return;
      const dwellRun = runIdRef.current;
      dwellTimer.current = setTimeout(() => {
        // Only auto-confirm while the run that telegraphed this proposal is
        // still the active one; a new run must not inherit the held action.
        if (!pausedRef.current && modeRef.current !== 'drive' && runIdRef.current === dwellRun) {
          void confirmHeld();
        }
      }, TELEGRAPH_DWELL_MS[modeRef.current]);
    },
    [pushEntry, confirmHeld],
  );

  /** One poll step: fetch perception for the run and telegraph anything held. */
  const poll = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId || pausedRef.current || !runningRef.current) return;
    try {
      const result = await browseWithMe({
        runId,
        controlMode: MODE_TO_CONTROL[modeRef.current],
      });
      // Discard results from a superseded run: a poll in flight when a new run
      // (or a stop) started must not telegraph the stale proposal.
      if (runIdRef.current !== runId) return;
      setPerception((prev) =>
        prev.status === 'loading' ? viewState.success(result) : viewState.success(result),
      );
      telegraph(result);
      setError(null);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(String(err));
    } finally {
      const interval = POLL_MS[modeRef.current];
      if (interval > 0 && runningRef.current && !pausedRef.current) {
        pollTimer.current = setTimeout(() => void pollRef.current(), interval);
      }
    }
  }, [telegraph]);

  const begin = useCallback(
    async (url: string, task: string) => {
      clearTimers();
      clearTelegraph();
      setApproval(null);
      setKeepReceipt(null);
      setPerception(viewState.loading());
      setError(null);
      try {
        const runId = `cobrowse-${Date.now()}`;
        runIdRef.current = runId;
        setSessionId(runId);
        let tab = tabIdRef.current;
        if (!tab) {
          tab = entryId();
          await tabCreate(tab, url);
          tabIdRef.current = tab;
          setTabId(tab);
        } else {
          await tabNavigate(tab, url);
        }
        await tabSetActive(tab);
        runningRef.current = true;
        setRunning(true);
        setPaused(false);
        pausedRef.current = false;
        const result = await browseWithMe({
          url,
          task,
          runId,
          controlMode: MODE_TO_CONTROL[modeRef.current],
        });
        // A second begin() may have superseded this run while it was starting;
        // do not paint or telegraph a run that is no longer active.
        if (runIdRef.current !== runId) return;
        setPerception(viewState.success(result));
        telegraph(result);
        const interval = POLL_MS[modeRef.current];
        if (interval > 0) pollTimer.current = setTimeout(() => void poll(), interval);
      } catch (err) {
        setPerception(viewState.error(String(err), () => void beginRef.current(url, task)));
      }
    },
    [clearTimers, clearTelegraph, telegraph, poll],
  );

  useEffect(() => {
    pollRef.current = poll;
    beginRef.current = begin;
  }, [poll, begin]);

  const approve = useCallback(async () => {
    if (!approval) return;
    pushEntry('approval', `Approved: ${approval.intent || approval.verb}`);
    await confirmHeld();
  }, [approval, pushEntry, confirmHeld]);

  const decline = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    setApproval(null);
    clearTelegraph();
    try {
      const result = await browseWithMe({
        runId,
        controlMode: MODE_TO_CONTROL[modeRef.current],
        veto: true,
      });
      // Drop the veto result if a newer run superseded this one mid-flight.
      if (runIdRef.current !== runId) return;
      setPerception(viewState.success(result));
      pushEntry('decline', 'Declined; the agent will propose a different step', result.live_browser);
    } catch (err) {
      setError(String(err));
    }
  }, [clearTelegraph, pushEntry]);

  /** Interrupt (D4): fired synchronously on stage input. No confirm dialog. */
  const interrupt = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return;
    if (dwellTimer.current) {
      clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    pausedRef.current = true;
    setPaused(true);
    setMode('pair');
    clearTelegraph();
    pushEntry('pause', 'Paused, you have the wheel');
  }, [setMode, clearTelegraph, pushEntry]);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    pushEntry('pause', 'Resumed');
    telegraphedRef.current = null;
    void poll();
  }, [poll, pushEntry]);

  /** Keep (D8): capture the current page into the workspace with a receipt. */
  const keep = useCallback(async () => {
    const tab = tabIdRef.current;
    if (!tab) return;
    try {
      const page = await extractVisibleText(tab);
      const receipt = await agentTabIngest({
        tabId: tab,
        url: page.url,
        title: page.title,
        text: page.text,
      });
      setKeepReceipt(receipt);
      pushEntry('capture', `Kept ${page.title || page.url}`, receipt);
      // Accumulate the Kept page into the carry bundle (HANDOFF-CARRY D1): a
      // real live browse event feeding the session bundle. Other event kinds
      // (highlight, margin thread, entity intersect) append here too as their
      // upstream slices land.
      const carrySession = runIdRef.current;
      if (carrySession) {
        void appendEvent(carrySession, {
          kind: 'page_kept',
          anchor: {
            url: page.url,
            title: page.title,
            quote: page.text ? page.text.slice(0, 200) : undefined,
          },
          receiptIds: [receipt.id],
          connectionExplanation: receipt.nearestNeighbor ?? undefined,
        });
      }
    } catch (err) {
      setError(String(err));
    }
  }, [pushEntry]);

  const dismissKeep = useCallback(() => setKeepReceipt(null), []);

  /** "Do it" on the suggested rail action: re-poll so a held action telegraphs;
   * a confirm-gated proposal routes through the approval card (D7 to D5). */
  const runSuggested = useCallback(async () => {
    telegraphedRef.current = null;
    await poll();
  }, [poll]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlistenFocus: (() => void) | null = null;
    let unlistenNav: (() => void) | null = null;
    void listenDesktopEvent<{ tabId: string }>('cobrowse://stage-focus', (payload) => {
      if (payload.tabId === tabIdRef.current) interrupt();
    }).then((fn) => {
      unlistenFocus = fn;
    });
    void listenDesktopEvent<{ tabId: string; url: string }>('cobrowse://navigation', (payload) => {
      if (payload.tabId === tabIdRef.current) {
        pushEntry('navigation', `Navigated to ${payload.url}`);
        const tab = tabIdRef.current;
        if (tab) void tabClearHighlight(tab).catch(() => undefined);
      }
    }).then((fn) => {
      unlistenNav = fn;
    });
    return () => {
      unlistenFocus?.();
      unlistenNav?.();
    };
  }, [interrupt, pushEntry]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    mode,
    setMode,
    running,
    paused,
    tabId,
    perception,
    approval,
    telegraphIntent,
    entries,
    keepReceipt,
    sessionId,
    error,
    begin,
    approve,
    decline,
    resume,
    keep,
    dismissKeep,
    runSuggested,
  };
}
