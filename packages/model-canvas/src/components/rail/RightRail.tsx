// SOURCING: OWOX/models RightRail (Apache-2.0). Share + OWOX Save chrome removed.

import type { ReactNode } from 'react';
import { PanelRight, Clock, Boxes } from 'lucide-react';
import type { RightPanelId } from './useRightPanel';

type Item = { id: RightPanelId; label: string; icon: ReactNode };

const ITEMS: Item[] = [
  { id: 'inspect', label: 'Inspect', icon: <PanelRight size={20} /> },
  { id: 'models', label: 'Models', icon: <Boxes size={20} /> },
  { id: 'history', label: 'History', icon: <Clock size={20} /> },
];

const railBtn = (on: boolean) =>
  `w-full flex flex-col items-center gap-1 py-[9px] px-1 rounded-lg text-[11px] font-medium border ${
    on
      ? 'bg-[color:var(--ij-editor,#fff)] text-[color:var(--ij-ink,#0f172a)] shadow-[0_1px_3px_rgba(15,23,42,0.08)] border-[color:var(--ij-border,#d8dee8)]'
      : 'border-transparent text-[color:var(--ij-text-secondary,#64748b)] hover:bg-[color:var(--ij-hover-surface,#f1f3f7)] hover:text-[color:var(--ij-ink,#0f172a)]'
  }`;

export function RightRail({
  active,
  onOpen,
}: {
  active: RightPanelId | null;
  onOpen: (id: RightPanelId) => void;
}) {
  return (
    <nav
      className="z-20 flex w-[60px] flex-shrink-0 flex-col items-center gap-1 border-l border-[color:var(--ij-border,#d8dee8)] bg-[color:var(--ij-bg,#fafafa)] px-[4px] py-[14px]"
      data-owox-rail
    >
      {ITEMS.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onOpen(it.id)}
            aria-current={on ? 'true' : undefined}
            className={railBtn(on)}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}
