'use client';

// SOURCING: @commonplace/block-view (descriptor resolution over ObjectQuery).
// The marriage requirement (G3): every pane is a view instance resolved by
// descriptor against the host. This component is the single resolution seam;
// tool windows and editor tabs both mount it. Unknown descriptors render the
// fallback card, never a crash.

import { useEffect, useState } from 'react';
import type { BlockHost, ObjectQuery, ObjectRef, ObjectSet } from '@commonplace/block-view/types';
import { CONSOLE_VIEW_REGISTRY, FallbackCard } from '@/views/registry';
import { ViewState } from '@/views/ViewStates';

function instanceQuery(instance: ObjectRef): ObjectQuery | null {
  const raw = instance.properties.query;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const types = (raw as { types?: unknown }).types;
  if (!Array.isArray(types)) return null;
  return raw as unknown as ObjectQuery;
}

export function ViewInstanceHost({ instance, host }: { instance: ObjectRef; host: BlockHost }) {
  const descriptorId = String(instance.properties.descriptor_id ?? '');
  const descriptor = CONSOLE_VIEW_REGISTRY.viewById(descriptorId);
  const query = instanceQuery(instance);
  const [set, setSet] = useState<ObjectSet | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    if (!query) return;
    Promise.resolve(host.query(query))
      .then((next) => {
        if (!active) return;
        setSet(next);
        if (typeof next.subscribe === 'function') {
          unsubscribe = next.subscribe((following) => {
            if (active) setSet(following);
          });
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
    // The instance's query is part of the arrangement data; re-run when the
    // instance object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, instance]);

  if (!descriptor) return <FallbackCard descriptorId={descriptorId || instance.id} />;
  if (failed) return <ViewState state="error" errorMessage="View query failed." />;
  if (!query || !set) return <ViewState state="loading" />;

  const Render = descriptor.render;
  return <Render set={set} host={host} />;
}
