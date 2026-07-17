'use client';

// SOURCING: hand-roll. The Int UI main toolbar with the RunWidget is a named
// chrome signature; no library models it. The run widget binds to real run
// state (the thread's isRunning): green --ij-running while a run is live.

import { useShellStore } from '@/lib/shell-store';
import { useThreadStore } from '@/lib/thread-store';
import { PresenceMark } from '@/components/mark/PresenceMark';
import { IconRun, IconSearch, IconStop } from './icons';

export function MainToolbar() {
  const isRunning = useThreadStore((state) => state.isRunning);
  const cancel = useThreadStore((state) => state.cancel);
  const setSearchOpen = useShellStore((state) => state.setSearchOpen);

  return (
    <header className="flex h-ij-toolbar shrink-0 items-center gap-2 border-b border-ij-seam bg-ij-chrome px-2">
      <span className="px-2 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        CommonPlace
      </span>
      <span className="text-ij-ink-info">Workspace</span>

      <div className="ml-auto flex items-center" style={{ gap: 'var(--rec-sibling-gap)' }}>
        {isRunning ? <PresenceMark state="acting" size={20} /> : null}
        <button
          type="button"
          data-run-widget
          data-running={isRunning ? 'true' : 'false'}
          aria-label={isRunning ? 'Stop the live run' : 'Run'}
          onClick={() => (isRunning ? cancel() : undefined)}
          disabled={!isRunning}
          className="flex h-ij-control items-center gap-1 rounded-ij-arc px-3 disabled:opacity-75"
          style={{
            background: isRunning ? 'var(--ij-running)' : 'var(--ij-raised)',
            color: isRunning ? 'var(--ij-ink-bright)' : 'var(--ij-ink)',
            transition: 'var(--rec-clickable-transition)',
          }}
        >
          {isRunning ? <IconStop size={14} /> : <IconRun size={14} />}
          {isRunning ? 'Running' : 'Run'}
        </button>
        <button
          type="button"
          aria-label="Search everywhere (double Shift)"
          onClick={() => setSearchOpen(true)}
          className="flex h-ij-control w-ij-control items-center justify-center rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
          style={{ width: 'var(--ij-control-h)', transition: 'var(--rec-clickable-transition)' }}
        >
          <IconSearch size={15} />
        </button>
      </div>
    </header>
  );
}
