'use client';

/* Records page: renders the RecordTable component with mock data.
   This page demonstrates the RecordTable in a V2 app context with
   minimal BlockHost implementation and mock ObjectSet. */

import { RecordTable } from '@/components/v2/record-table';
import type { ObjectSet, BlockHost, ObjectRef, ObjectShape, ObjectQuery, Result, ObjectActionReceipt, ObjectAction, ThemeTokens } from '@/lib/block-view/types';
import styles from './records.module.css';

// ── Mock ObjectRef records ──
const MOCK_RECORDS: ObjectRef[] = [
  {
    id: 'rec_001',
    type: 'record',
    properties: {
      id: 'rec_001',
      title: 'Q3 Budget Review',
      status: 'active',
      owner: 'Alice Chen',
      created: '2026-07-01',
      updated: '2026-07-08',
    },
  },
  {
    id: 'rec_002',
    type: 'record',
    properties: {
      id: 'rec_002',
      title: 'Engineering Sprint Planning',
      status: 'in_progress',
      owner: 'Bob Martinez',
      created: '2026-06-28',
      updated: '2026-07-08',
    },
  },
  {
    id: 'rec_003',
    type: 'record',
    properties: {
      id: 'rec_003',
      title: 'Product Roadmap 2026-H2',
      status: 'active',
      owner: 'Carol Singh',
      created: '2026-06-15',
      updated: '2026-07-05',
    },
  },
  {
    id: 'rec_004',
    type: 'record',
    properties: {
      id: 'rec_004',
      title: 'Customer Feedback Analysis',
      status: 'completed',
      owner: 'David Lee',
      created: '2026-06-10',
      updated: '2026-07-03',
    },
  },
  {
    id: 'rec_005',
    type: 'record',
    properties: {
      id: 'rec_005',
      title: 'Infrastructure Audit',
      status: 'pending',
      owner: 'Emma Wilson',
      created: '2026-07-08',
      updated: '2026-07-08',
    },
  },
];

// ── Mock ObjectShape ──
const MOCK_SHAPE: ObjectShape = {
  types: ['record'],
  fields: ['id', 'title', 'status', 'owner', 'created', 'updated'],
  relations: [],
  axes: { spatial: false, temporal: true, embeddable: false },
  cardinality: 'many',
};

// ── Mock ObjectSet ──
const mockObjectSet: ObjectSet = {
  objects: MOCK_RECORDS,
  shape: MOCK_SHAPE,
  notes: ['Mock records for RecordTable demonstration'],
  subscribe: (callback) => {
    // Minimal subscription; no-op for this demo
    return () => {};
  },
};

// ── Mock theme tokens ──
const MOCK_TOKENS: ThemeTokens = {
  color: {
    primary: '#0066cc',
    text: '#1a1a1a',
    background: '#ffffff',
    border: '#d0d0d0',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
  typography: {
    body: 'system-ui, -apple-system, sans-serif',
    mono: 'Menlo, Monaco, monospace',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
};

// ── Mock BlockHost ──
const mockBlockHost: BlockHost = {
  query: async (query: ObjectQuery) => {
    // Placeholder: would normally query the backend
    return mockObjectSet;
  },
  emit: async (action: ObjectAction): Promise<Result<ObjectActionReceipt>> => {
    // Placeholder: would normally emit actions to the backend
    return {
      ok: true,
      value: {
        action_kind: action.kind,
        status: 'accepted',
      },
    };
  },
  viewsFor: (shape: ObjectShape) => {
    // Placeholder: would return available views for this shape
    return [];
  },
  tokens: MOCK_TOKENS,
};

export default function RecordsPage() {
  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Data / Records</div>
          <h1 className="p-h1">Records</h1>
        </div>
        <div className="p-cmd">
          <span>Search or command</span>
          <span className="p-kbd">&#8984;K</span>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.frame}>
          <RecordTable objectSet={mockObjectSet} host={mockBlockHost} />
        </div>
      </div>
    </>
  );
}
