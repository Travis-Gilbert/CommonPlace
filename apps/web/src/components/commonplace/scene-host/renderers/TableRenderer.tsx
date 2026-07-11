'use client';

import type { SceneRendererProps } from '../types';

export default function TableRenderer({ scenePackage }: SceneRendererProps) {
  const rows = tableRows(scenePackage);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 12);
  return (
    <div className="cp-scene-table-wrap">
      <table className="cp-scene-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, index) => (
            <tr key={`${row.id ?? index}`}>
              {columns.map((column) => (
                <td key={column}>{formatCell(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function tableRows(scenePackage: SceneRendererProps['scenePackage']): Array<Record<string, unknown>> {
  const paramsRows = scenePackage.projection.params?.rows;
  if (Array.isArray(paramsRows)) {
    return paramsRows.filter(isRecord);
  }
  return scenePackage.atoms.map((atom) => ({
    id: atom.id,
    kind: atom.kind,
    label: atom.label ?? atom.id,
    ...(atom.metadata ?? {}),
  }));
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
