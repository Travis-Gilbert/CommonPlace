'use client';

// SOURCING: @xyflow/react native drag target plus generated
// @commonplace/program-contracts. Theorem remains the preset authority.

import type {
  ProgramBindingPreset,
  ProgramBindingPresetHead,
} from '@commonplace/program-contracts';

export const BINDING_PRESET_DRAG_TYPE = 'application/x-theorem-binding-preset';

export function visiblePresetRoster(
  preset: ProgramBindingPreset,
): readonly ProgramBindingPresetHead[] {
  return preset.sealed ? [] : preset.roster ?? [];
}

export interface BindingStationTrayProps {
  readonly presets: readonly ProgramBindingPreset[];
  readonly selectedNodeId: string | null;
  readonly busy: boolean;
  readonly onApply: (preset: ProgramBindingPreset, nodeId: string) => void;
}

export function BindingStationTray({
  presets,
  selectedNodeId,
  busy,
  onApply,
}: BindingStationTrayProps) {
  return (
    <aside
      aria-label="Binding stations"
      className="flex w-48 shrink-0 flex-col border-r border-ij-seam bg-ij-panel"
      data-binding-station-tray
    >
      <header className="border-b border-ij-seam px-3 py-2">
        <p className="text-xs text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Binding stations
        </p>
        <p className="mt-1 text-xs text-ij-ink-info">
          Select a node, or drag a preset onto one.
        </p>
      </header>
      <div className="grid gap-2 overflow-auto p-2">
        {presets.map((preset) => {
          const roster = visiblePresetRoster(preset);
          return (
            <button
              key={preset.preset_id}
              type="button"
              draggable={!busy}
              disabled={busy}
              data-preset-id={preset.preset_id}
              data-sealed={preset.sealed ? 'true' : 'false'}
              className="rounded-ij-arc border border-ij-control-border bg-ij-editor p-2 text-left hover:bg-ij-hover-surface disabled:opacity-50"
              title={selectedNodeId
                ? `Apply ${preset.display_name} to ${selectedNodeId}`
                : `Drag ${preset.display_name} onto a program node`}
              onClick={() => {
                if (selectedNodeId) onApply(preset, selectedNodeId);
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData(BINDING_PRESET_DRAG_TYPE, preset.preset_id);
                event.dataTransfer.setData('text/plain', preset.preset_id);
              }}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs text-ij-ink">{preset.display_name}</span>
                <span className="font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
                  {preset.topology}
                </span>
              </span>
              <span className="mt-1 block text-xs text-ij-ink-info">
                {preset.budget_units} units, {preset.sealed ? 'sealed' : 'transparent'}
              </span>
              {roster.length > 0 ? (
                <span className="mt-1 block font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
                  {roster.map((head) => `${head.provider}/${head.model}`).join(', ')}
                </span>
              ) : null}
            </button>
          );
        })}
        {presets.length === 0 ? (
          <p className="px-1 text-xs text-ij-ink-info">No reachable presets.</p>
        ) : null}
      </div>
    </aside>
  );
}
