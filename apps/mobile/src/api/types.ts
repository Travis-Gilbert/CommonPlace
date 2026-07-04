/** Mirrors apps/commonplace-api/src/schema.rs (async-graphql camelCase). */

export type ItemGql = {
  id: string;
  kind: string;
  title: string;
  bodyText?: string | null;
  blobHash?: string | null;
  mime?: string | null;
  source?: string | null;
  residency: string;
  tags: string[];
  collections: string[];
  classification?: string | null;
  status?: string | null;
  priority?: string | null;
  dueAtMs?: number | null;
  /** Present once PT-008 lands server-side; optional so older nodes still parse. */
  remindAtMs?: number | null;
  path?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export type CollectionGql = {
  id: string;
  name: string;
  kind: string;
  color?: string | null;
  createdAtMs: number;
};

export type AskResult = {
  answer: string;
  answerKind: 'EMPTY' | 'MODEL' | string;
  provenance: { item: ItemGql; score: number; arms: string[] }[];
};

export type TheoremAgentRun = {
  answer: string;
  answerKind: string;
  bindingId: string;
  runId: string;
  heads: string[];
  evidenceCount: number;
};

export type Briefing = {
  recent: ItemGql[];
  newlyConnected: { item: ItemGql; connections: number }[];
  openThreads: ItemGql[];
};

export type OrganizeClassification = {
  targetCollectionId?: string | null;
  targetCollectionLabel?: string | null;
  confidence: number;
};

export type OrganizeItem = {
  id: string;
  kind: string;
  title: string;
  preview: string;
  source: string;
  arrivedAt: string;
  classification: OrganizeClassification;
  timeSensitive: boolean;
  expectedAction?: string | null;
  tags: string[];
};

export type OrganizeSnapshot = {
  needsYou: OrganizeItem[];
  organizedToday: {
    mostRecent: { item: OrganizeItem; filedAt: string } | null;
    groups: { collectionId: string; label: string; count: number }[];
    totalCount: number;
  };
  dailyProgress: { timeframe: string; done: number; total: number };
  needsYouCeiling: number;
};

export type SearchHit = { item: ItemGql; score: number };
