// SOURCING: none — vendored upstream module (provenance pinned in
// apps/chat/UPSTREAM.md). The admission rule added here is per-actor fairness
// over this daemon's own session records: pure logic against local types, with
// no upstream component that models it. An LRU cache library was considered
// and rejected — the concept needed is "do not evict a different tenant's live
// entry", which is an authorization rule, not a recency policy.

import type { TokenScope } from "./types.js";
import { shortId } from "./utils.js";

/**
 * The store is full of other actors' live sessions.
 *
 * A distinct type rather than an ApiError so this module keeps no dependency
 * on the HTTP layer; the route maps it to 429.
 */
export class FileSessionCapacityError extends Error {
  constructor() {
    super("File session capacity reached");
    this.name = "FileSessionCapacityError";
  }
}

export type FileSessionEventType = "write" | "delete" | "rename" | "mkdir";

export type FileSessionEvent = {
  id: string;
  seq: number;
  workspaceId: string;
  type: FileSessionEventType;
  path: string;
  toPath?: string;
  revision?: string;
  timestamp: number;
};

export type FileSessionRecord = {
  id: string;
  workspaceId: string;
  workspaceRoot: string;
  actorTokenHash: string;
  actorScope: TokenScope;
  canWrite: boolean;
  createdAt: number;
  expiresAt: number;
};

type WorkspaceEventState = {
  seq: number;
  events: FileSessionEvent[];
};

export class FileSessionStore {
  private sessions = new Map<string, FileSessionRecord>();

  private workspaceEvents = new Map<string, WorkspaceEventState>();

  private maxSessions: number;

  private maxSessionsPerActor: number;

  private maxEventsPerWorkspace: number;

  constructor(options?: {
    maxSessions?: number;
    maxSessionsPerActor?: number;
    maxEventsPerWorkspace?: number;
  }) {
    this.maxSessions = options?.maxSessions ?? 256;
    // One actor cannot hold more than an eighth of the store, so it takes
    // eight distinct tokens to reach the global cap rather than one.
    this.maxSessionsPerActor = options?.maxSessionsPerActor ?? 32;
    this.maxEventsPerWorkspace = options?.maxEventsPerWorkspace ?? 500;
  }

  create(input: {
    workspaceId: string;
    workspaceRoot: string;
    actorTokenHash: string;
    actorScope: TokenScope;
    canWrite: boolean;
    ttlMs: number;
  }): FileSessionRecord {
    this.pruneExpired();
    this.makeRoomFor(input.actorTokenHash);

    const now = Date.now();
    const record: FileSessionRecord = {
      id: shortId(),
      workspaceId: input.workspaceId,
      workspaceRoot: input.workspaceRoot,
      actorTokenHash: input.actorTokenHash,
      actorScope: input.actorScope,
      canWrite: input.canWrite,
      createdAt: now,
      expiresAt: now + input.ttlMs,
    };
    this.sessions.set(record.id, record);
    return record;
  }

  get(sessionId: string): FileSessionRecord | null {
    this.pruneExpired();
    const value = this.sessions.get(sessionId);
    return value ?? null;
  }

  renew(sessionId: string, ttlMs: number): FileSessionRecord | null {
    this.pruneExpired();
    const value = this.sessions.get(sessionId);
    if (!value) return null;
    value.expiresAt = Date.now() + ttlMs;
    this.sessions.set(sessionId, value);
    return value;
  }

  close(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  recordWorkspaceEvent(input: {
    workspaceId: string;
    type: FileSessionEventType;
    path: string;
    toPath?: string;
    revision?: string;
  }): FileSessionEvent {
    const state = this.workspaceEvents.get(input.workspaceId) ?? { seq: 0, events: [] };
    const event: FileSessionEvent = {
      id: shortId(),
      seq: state.seq + 1,
      workspaceId: input.workspaceId,
      type: input.type,
      path: input.path,
      toPath: input.toPath,
      revision: input.revision,
      timestamp: Date.now(),
    };
    state.seq = event.seq;
    state.events.push(event);
    if (state.events.length > this.maxEventsPerWorkspace) {
      state.events.splice(0, state.events.length - this.maxEventsPerWorkspace);
    }
    this.workspaceEvents.set(input.workspaceId, state);
    return event;
  }

  listWorkspaceEvents(workspaceId: string, since = 0): { items: FileSessionEvent[]; cursor: number } {
    const state = this.workspaceEvents.get(workspaceId);
    if (!state) {
      return { items: [], cursor: 0 };
    }
    const cursor = Number.isFinite(since) && since > 0 ? since : 0;
    const items = state.events.filter((item) => item.seq > cursor);
    return { items, cursor: state.seq };
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id);
      }
    }
  }

  /** The caller's own soonest-expiring session, or null if they have none. */
  private oldestSessionFor(actorTokenHash: string): string | null {
    let oldestId: string | null = null;
    let oldestExpiry = Number.POSITIVE_INFINITY;
    for (const [id, session] of this.sessions) {
      if (session.actorTokenHash !== actorTokenHash) continue;
      if (session.expiresAt < oldestExpiry) {
        oldestExpiry = session.expiresAt;
        oldestId = id;
      }
    }
    return oldestId;
  }

  /**
   * Free a slot for `actorTokenHash`, never at another actor's expense.
   *
   * The previous rule evicted whichever session expired first, globally. A
   * viewer may create sessions and request the maximum TTL, so one viewer
   * could fill the store and push out collaborators' live default-TTL
   * sessions, whose renew, catalog, and file calls then started returning 404
   * with nothing to explain it. Capacity pressure now falls on the actor
   * causing it: they recycle their own oldest session, or they are told the
   * store is full.
   */
  private makeRoomFor(actorTokenHash: string): void {
    let ownCount = 0;
    for (const session of this.sessions.values()) {
      if (session.actorTokenHash === actorTokenHash) ownCount += 1;
    }

    if (ownCount >= this.maxSessionsPerActor) {
      const own = this.oldestSessionFor(actorTokenHash);
      if (own) this.sessions.delete(own);
      return;
    }

    if (this.sessions.size < this.maxSessions) return;

    const own = this.oldestSessionFor(actorTokenHash);
    if (own) {
      this.sessions.delete(own);
      return;
    }
    throw new FileSessionCapacityError();
  }
}
