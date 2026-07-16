'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStudioWorkbench } from './WorkbenchContext';
import type { Sheet } from '@/lib/studio-api';

function DragHandle() {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, opacity: 0.35 }}
    >
      <circle cx="3" cy="2.5" r="1.25" fill="currentColor" />
      <circle cx="3" cy="7" r="1.25" fill="currentColor" />
      <circle cx="3" cy="11.5" r="1.25" fill="currentColor" />
      <circle cx="7" cy="2.5" r="1.25" fill="currentColor" />
      <circle cx="7" cy="7" r="1.25" fill="currentColor" />
      <circle cx="7" cy="11.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

/**
 * SheetList renders in the StudioSidebar when the active content item has
 * at least one sheet. Paper card design with drag-to-reorder, progress bars,
 * word count targets, and aggregate footer.
 */
export default function SheetList({ fullPanel = false }: { fullPanel?: boolean } = {}) {
  const { editorState } = useStudioWorkbench();
  const {
    sheets,
    activeSheetId,
    onSetActiveSheet,
    onAddSheet,
    onDeleteSheet,
    onReorderSheets,
    onToggleMaterial,
    onUpdateSheetTarget,
  } = editorState;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sheets.findIndex((s) => s.id === String(active.id));
    const newIndex = sheets.findIndex((s) => s.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const reordered = arrayMove(sheets, oldIndex, newIndex);
    onReorderSheets?.(reordered.map((s) => s.id));
  }

  /* Aggregate progress for footer */
  const totalWords = sheets.reduce((sum, s) => sum + s.wordCount, 0);
  const totalTarget = sheets.reduce((sum, s) => sum + (s.wordCountTarget ?? 0), 0);

  return (
    <div className="studio-sheet-list-section" style={fullPanel ? { flex: 1, overflowY: 'auto' } : undefined}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px 4px',
        }}
      >
        <span className="studio-nav-section-label" style={{ padding: 0 }}>
          SHEETS
        </span>
        <button
          type="button"
          onClick={onAddSheet}
          className="studio-sheet-add-btn"
          aria-label="Add sheet"
          title="Add sheet"
        >
          +
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sheets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div style={{ padding: '0 12px' }}>
            {sheets.map((sheet) => (
              <SheetItem
                key={sheet.id}
                sheet={sheet}
                isActive={sheet.id === activeSheetId}
                onSelect={() => onSetActiveSheet?.(sheet.id)}
                onDelete={() => onDeleteSheet?.(sheet.id)}
                onUpdateTarget={onUpdateSheetTarget}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Footer: aggregate progress */}
      <div className="studio-sheet-footer" style={{
        marginTop: 'auto',
        paddingTop: '14px',
        borderTop: '1px solid rgba(240, 234, 224, 0.10)',
        padding: '14px 18px 10px',
      }}>
        {totalTarget > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              flex: 1,
              height: '3px',
              background: 'rgba(240, 234, 224, 0.08)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${totalTarget > 0 ? Math.min(100, (totalWords / totalTarget) * 100) : 0}%`,
                height: '100%',
                background: totalWords >= totalTarget ? '#5A7A4A' : 'var(--studio-tc-bright)',
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
            }}>
              {totalWords.toLocaleString()} / {totalTarget.toLocaleString()}w
            </span>
          </div>
        )}
        <span style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          color: 'var(--studio-text-3)',
        }}>
          {sheets.length} sheet{sheets.length !== 1 ? 's' : ''} total
        </span>
      </div>
    </div>
  );
}

/* ── Paper card sheet item ─────────────────────── */

function SheetItem({
  sheet,
  isActive,
  onSelect,
  onDelete,
  onUpdateTarget,
}: {
  sheet: Sheet;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdateTarget?: (id: string, target: number | null) => void;
}) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sheet.id,
  });

  const label = sheet.title.trim() || null;
  const progress = sheet.wordCountTarget
    ? Math.min(100, (sheet.wordCount / sheet.wordCountTarget) * 100)
    : null;
  const isComplete = progress !== null && progress >= 100;

  const handleTargetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetInput(sheet.wordCountTarget?.toString() ?? '');
    setEditingTarget(true);
  };

  const commitTarget = () => {
    setEditingTarget(false);
    const val = parseInt(targetInput, 10);
    if (isNaN(val) || val <= 0) {
      onUpdateTarget?.(sheet.id, null);
    } else {
      onUpdateTarget?.(sheet.id, val);
    }
  };

  return (
        <div
          ref={setNodeRef}
          className={`studio-sheet-paper ${isActive ? 'studio-sheet-paper--active' : ''}`}
          data-dragging={isDragging ? 'true' : undefined}
          onClick={onSelect}
          style={{
            transform: CSS.Transform.toString(transform),
            transition,
          }}
        >
          {/* Active indicator bar */}
          {isActive && <div className="studio-sheet-paper-accent" />}

          <div className="studio-sheet-paper-content">
            <span
              {...attributes}
              {...listeners}
              className="studio-sheet-drag-handle"
              onClick={(e) => e.stopPropagation()}
            >
              <DragHandle />
            </span>

            <div className="studio-sheet-paper-body">
              <div className="studio-sheet-paper-title">
                {label ?? (
                  <em style={{ opacity: 0.45, fontStyle: 'italic' }}>Untitled</em>
                )}
              </div>

              {/* Progress bar + word count */}
              <div className="studio-sheet-paper-meta">
                {progress !== null && (
                  <div className="studio-sheet-paper-progress">
                    <div
                      className="studio-sheet-paper-progress-fill"
                      style={{
                        width: `${progress}%`,
                        background: isComplete ? '#5A7A4A' : 'var(--studio-tc)',
                      }}
                    />
                  </div>
                )}
                {editingTarget ? (
                  <input
                    type="number"
                    className="studio-sheet-target-input"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onBlur={commitTarget}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitTarget();
                      if (e.key === 'Escape') setEditingTarget(false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    placeholder="target"
                    min={1}
                  />
                ) : (
                  <span
                    className="studio-sheet-paper-wordcount"
                    onClick={handleTargetClick}
                    title="Click to set word count target"
                  >
                    {sheet.wordCount > 0 ? `${sheet.wordCount}w` : '0w'}
                    {sheet.wordCountTarget ? ` / ${sheet.wordCountTarget}` : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Delete button, visible on hover */}
            <button
              type="button"
              className="studio-sheet-paper-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label={`Delete sheet ${label ?? 'Untitled'}`}
              title="Delete sheet"
            >
              &times;
            </button>
          </div>

          {/* Faint ruled lines for paper feel */}
          <div className="studio-sheet-paper-lines">
            <div className="studio-sheet-paper-line" />
            <div className="studio-sheet-paper-line" style={{ width: '85%' }} />
            <div className="studio-sheet-paper-line" style={{ width: label ? '60%' : '75%', borderStyle: label ? 'solid' : 'dashed' }} />
          </div>
        </div>
  );
}
