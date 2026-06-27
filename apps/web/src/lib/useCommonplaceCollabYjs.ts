'use client';

import { useEffect, useMemo, useState } from 'react';
import { HocuspocusProvider, type WebSocketStatus } from '@hocuspocus/provider';
import { useLocalYjs } from '@/lib/useLocalYjs';

export type CommonplaceCollabStatus =
  | 'disabled'
  | 'token-loading'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'authenticated'
  | 'auth-failed';

export interface UseCommonplaceCollabYjsResult {
  doc: ReturnType<typeof useLocalYjs>['doc'];
  localSynced: boolean;
  editorSynced: boolean;
  collabEnabled: boolean;
  collabSynced: boolean;
  collabStatus: CommonplaceCollabStatus;
  collaboratorCount: number;
}

const COLLAB_URL = process.env.NEXT_PUBLIC_COMMONPLACE_COLLAB_URL?.replace(/\/+$/, '') ?? '';
const COLLAB_TOKEN_ENDPOINT = process.env.NEXT_PUBLIC_COMMONPLACE_COLLAB_TOKEN_ENDPOINT
  ?? '/api/commonplace/collab-token';
const LEGACY_COLLAB_TOKEN = process.env.NEXT_PUBLIC_COMMONPLACE_COLLAB_TOKEN ?? '';

function documentName(contentType: string, id: string): string {
  if (contentType === 'commonplace-page') {
    return `commonplace-page:${id}`;
  }
  return `${contentType}:${id}`;
}

function mapStatus(status: WebSocketStatus): CommonplaceCollabStatus {
  switch (status) {
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    default:
      return 'disconnected';
  }
}

export function useCommonplaceCollabYjs(
  contentType: string,
  id: string,
): UseCommonplaceCollabYjsResult {
  const local = useLocalYjs(contentType, id);
  const collabEnabled = Boolean(COLLAB_URL);
  const name = useMemo(() => documentName(contentType, id), [contentType, id]);
  const [collabSynced, setCollabSynced] = useState(false);
  const [collabStatus, setCollabStatus] = useState<CommonplaceCollabStatus>(
    collabEnabled ? 'connecting' : 'disabled',
  );
  const [collaboratorCount, setCollaboratorCount] = useState(0);

  useEffect(() => {
    if (!collabEnabled) return;
    let disposed = false;
    let provider: HocuspocusProvider | null = null;

    async function tokenForDocument(): Promise<string | null> {
      if (LEGACY_COLLAB_TOKEN) return LEGACY_COLLAB_TOKEN;
      setCollabStatus('token-loading');
      const response = await fetch(COLLAB_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentName: name }),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`collab token ${response.status}`);
      }
      const body = (await response.json()) as { token?: string };
      return body.token ?? null;
    }

    void tokenForDocument()
      .then((token) => {
        if (disposed) return;
        provider = new HocuspocusProvider({
          url: COLLAB_URL,
          name,
          document: local.doc,
          token,
          sessionAwareness: true,
          onStatus: ({ status }) => {
            setCollabStatus(mapStatus(status));
          },
          onSynced: ({ state }) => {
            setCollabSynced(state);
          },
          onAuthenticated: () => {
            setCollabStatus('authenticated');
          },
          onAuthenticationFailed: () => {
            setCollabStatus('auth-failed');
          },
          onAwarenessChange: ({ states }) => {
            setCollaboratorCount(Math.max(0, states.length - 1));
          },
        });

        provider.setAwarenessField('user', {
          name: 'CommonPlace user',
          color: '#2d5f6b',
          surface: contentType,
        });
      })
      .catch(() => {
        if (!disposed) {
          setCollabStatus('auth-failed');
        }
      });

    return () => {
      disposed = true;
      provider?.destroy();
    };
  }, [collabEnabled, contentType, local.doc, name]);

  return {
    doc: local.doc,
    localSynced: local.synced,
    editorSynced: local.synced && (!collabEnabled || collabSynced),
    collabEnabled,
    collabSynced,
    collabStatus,
    collaboratorCount,
  };
}
