// SOURCING: OWOX/models TopBar (Apache-2.0). Product chrome gutted —
// no OWOX logo/Push/Share/Supabase Enable; Declare + OKF import/export remain.

import { useState } from 'react';
import { Download, Upload, ChevronDown, FileText } from 'lucide-react';
import { LibraryIcon } from '../lib/icons';

export interface TopBarProps {
  modelName?: string;
  onImport?: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  onLibrary?: () => void;
  onDeclare?: () => void;
  declareDisabled?: boolean;
  pendingCount?: number;
}

export function TopBar({
  modelName = 'Data model',
  onImport,
  onExport,
  exportDisabled = false,
  onLibrary,
  onDeclare,
  declareDisabled = false,
  pendingCount = 0,
}: TopBarProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  return (
    <header
      className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-[color:var(--ij-border,#d8dee8)] bg-[color:var(--ij-editor,#fff)] px-3"
      data-owox-topbar
    >
      <div className="min-w-0 flex-1 truncate text-[13px] font-[650] text-[color:var(--ij-ink,#0f172a)]">
        {modelName}
      </div>

      {onLibrary ? (
        <button
          type="button"
          onClick={onLibrary}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--ij-control-border,#d8dee8)] px-2.5 text-[12px] font-medium text-[color:var(--ij-ink,#0f172a)] hover:bg-[color:var(--ij-hover-surface,#f1f3f7)]"
        >
          <LibraryIcon size={14} /> Templates
        </button>
      ) : null}

      {onImport ? (
        <button
          type="button"
          onClick={onImport}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--ij-control-border,#d8dee8)] px-2.5 text-[12px] font-medium text-[color:var(--ij-ink,#0f172a)] hover:bg-[color:var(--ij-hover-surface,#f1f3f7)]"
        >
          <Upload size={14} /> Import OKF
        </button>
      ) : null}

      <div className="relative">
        <button
          type="button"
          disabled={exportDisabled}
          onClick={() => {
            if (onExport) onExport();
            else setExportMenuOpen((open) => !open);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--ij-control-border,#d8dee8)] px-2.5 text-[12px] font-medium text-[color:var(--ij-ink,#0f172a)] hover:bg-[color:var(--ij-hover-surface,#f1f3f7)] disabled:opacity-50"
        >
          <Download size={14} /> Export
          <ChevronDown size={12} />
        </button>
        {exportMenuOpen && onExport ? (
          <div className="absolute right-0 z-30 mt-1 w-44 rounded-md border border-[color:var(--ij-border,#d8dee8)] bg-[color:var(--ij-editor,#fff)] py-1 shadow-lg">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[color:var(--ij-hover-surface,#f1f3f7)]"
              onClick={() => {
                setExportMenuOpen(false);
                onExport();
              }}
            >
              <FileText size={14} /> OKF markdown
            </button>
          </div>
        ) : null}
      </div>

      {onDeclare ? (
        <button
          type="button"
          disabled={declareDisabled}
          onClick={onDeclare}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--ij-button,#1e88e5)] px-3 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Declare
          {pendingCount > 0 ? (
            <span className="opacity-80">({pendingCount})</span>
          ) : null}
        </button>
      ) : null}
    </header>
  );
}
