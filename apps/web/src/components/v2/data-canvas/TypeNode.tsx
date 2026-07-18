'use client';

// Custom XYFlow node: displays a TypeDef's name, field list with type
// icons, and provides output handles on each field for drag-to-relate.
// Supports inline field add (via +), field delete, and field edit (dbl-click).

import { memo, useCallback, useState, type FC, type KeyboardEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus, Trash2 } from '@/lib/icons';
import type { PropertyDef } from '@/lib/block-view/types';
import styles from './data-canvas.module.css';

export interface TypeNodeData {
  label: string;
  typeId: string;
  fields: readonly PropertyDef[];
  onAddField?: (typeId: string, field: { name: string; type: string }) => void;
  onEditField?: (typeId: string, oldName: string, field: { name: string; type: string }) => void;
  onDeleteField?: (typeId: string, fieldName: string) => void;
  [key: string]: unknown;
}

const TYPE_ICONS: Record<string, string> = {
  string: 'Aa',
  text: '¶',
  number: '#',
  integer: 'Σ',
  boolean: '✓',
  json: '{}',
  id: '№',
  timestamp_ms: '⏱',
  vector: '⬡',
  string_list: '[]',
};

const iconFor = (pt: string): string => TYPE_ICONS[pt] ?? '•';

const FIELD_TYPE_OPTIONS = [
  'string',
  'text',
  'number',
  'integer',
  'boolean',
  'json',
  'id',
  'timestamp_ms',
  'string_list',
];

export const TypeNode: FC<NodeProps> = memo(({ data, selected }) => {
  const d = data as unknown as TypeNodeData;
  const [adding, setAdding] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('string');
  // Field editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldName, setEditFieldName] = useState('');
  const [editFieldType, setEditFieldType] = useState('string');

  const commitAdd = useCallback(() => {
    if (!fieldName.trim()) return;
    d.onAddField?.(d.typeId, { name: fieldName.trim(), type: fieldType });
    setFieldName('');
    setFieldType('string');
    setAdding(false);
  }, [d, fieldName, fieldType]);

  const cancelAdd = useCallback(() => {
    setFieldName('');
    setAdding(false);
  }, []);

  const startEdit = useCallback((f: PropertyDef) => {
    setEditingField(f.name);
    setEditFieldName(f.name);
    setEditFieldType(f.type);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editFieldName.trim() || !editingField) return;
    d.onEditField?.(d.typeId, editingField, {
      name: editFieldName.trim(),
      type: editFieldType,
    });
    setEditingField(null);
  }, [d, editingField, editFieldName, editFieldType]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  const handleEditKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') cancelEdit();
    },
    [commitEdit, cancelEdit],
  );

  return (
    <div
      className={`${styles.typeNode} ${selected ? styles.typeNodeSelected : ''}`}
    >
      {/* Header: type name */}
      <div className={styles.typeHeader}>
        <span className={styles.typeName}>{d.label}</span>
      </div>

      {/* Field list */}
      <div className={styles.fieldList}>
        {d.fields.map((f) => {
          const isEditing = editingField === f.name;
          return (
            <div
              key={f.name}
              className={`${styles.fieldRow} ${styles.fieldRowHover}`}
              onDoubleClick={() => startEdit(f)}
            >
              {isEditing ? (
                <div className={styles.addForm}>
                  <input
                    className={styles.addInput}
                    autoFocus
                    value={editFieldName}
                    onChange={(e) => setEditFieldName(e.target.value)}
                    onKeyDown={handleEditKey}
                  />
                  <select
                    className={styles.addSelect}
                    value={editFieldType}
                    onChange={(e) => setEditFieldType(e.target.value)}
                  >
                    {FIELD_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button className={styles.addConfirm} onClick={commitEdit}>
                    ✓
                  </button>
                </div>
              ) : (
                <>
                  <span className={styles.fieldIcon}>{iconFor(f.type)}</span>
                  <span className={styles.fieldName}>{f.name}</span>
                  <span className={styles.fieldType}>{f.type}</span>
                  <button
                    className={styles.fieldDeleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      d.onDeleteField?.(d.typeId, f.name);
                    }}
                    title="Delete field"
                  >
                    <Trash2 size={10} />
                  </button>
                  {/* Output handle for drag-to-relate */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`field-${f.name}`}
                    className={styles.fieldHandle}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add field: inline or button */}
      {adding ? (
        <div className={styles.addForm}>
          <input
            className={styles.addInput}
            autoFocus
            placeholder="Field name"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') cancelAdd();
            }}
          />
          <select
            className={styles.addSelect}
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
          >
            {FIELD_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button className={styles.addConfirm} onClick={commitAdd}>
            +
          </button>
        </div>
      ) : (
        <button
          className={styles.addBtn}
          onClick={() => setAdding(true)}
          title="Add field"
        >
          <Plus size={12} /> Add field
        </button>
      )}

      {/* Left handle for incoming relations */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className={styles.typeHandle}
      />
    </div>
  );
});

TypeNode.displayName = 'TypeNode';
