'use client';

// SOURCING: @commonplace/model-canvas (OWOX hard fork, Apache-2.0) through the
// Data model surface's own ForkDiagramCanvas, per the "Inspector rail data
// canvas" ledger row.
//
// The rail used to carry JsonCanvasLayer, a second canvas language, which is
// why a node in the rail and a node on the Data model surface did not look or
// behave alike. SPEC-COMMONPLACE-MODEL-CANVAS-FORK-1.0 makes the OWOX fork the
// one canvas, so the rail mounts the same component the surface does rather
// than a rail-flavoured copy of it: MartNode, RelEdge and the substrate edge
// language arrive already shared.
//
// Reading, and writing where the registry allows it. Pin and unpin post to the
// same routes the surface posts to, because a canvas that renders ghosts and
// then refuses to adopt one is a picture of an affordance rather than the
// affordance. Layout is local to the rail: the surface owns the persisted
// arrangement, and a rail dragging the same document would fight it.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  emptyDeclaredModel,
  emptyObservedModel,
  type DeclaredModel,
  type ObservedModel,
  type PinKind,
  type ScopeRef,
} from '@commonplace/data-model-contracts';
import { fetchObservedModel, postPin, postUnpin } from '@/lib/observed-model-client';
import { ForkDiagramCanvas } from '@/views/model/diagram/ForkDiagramCanvas';
import type { LayoutPositions } from '@/views/model/diagram/layout';
import type { ModelSelection } from '@/views/model/modelQuery';

export interface RailModelCanvasProps {
  /**
   * The topic whose model the rail shows. The rail is chrome and has no scope
   * of its own, so the shell passes one down. Empty renders the canvas empty,
   * which is the shell's honest state before a scope exists, not a placeholder.
   */
  readonly topicId?: string;
}

export function RailModelCanvas({ topicId = '' }: RailModelCanvasProps) {
  const scope = useMemo<ScopeRef>(() => ({ kind: 'topic', topicId }), [topicId]);
  const [observed, setObserved] = useState<ObservedModel>(() => emptyObservedModel(scope));
  const [declared, setDeclared] = useState<DeclaredModel>(() => emptyDeclaredModel(scope));
  const [pendingPins, setPendingPins] = useState<readonly string[]>([]);
  const [positions, setPositions] = useState<LayoutPositions>({});
  const [selection, setSelection] = useState<ModelSelection | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!topicId) {
      setObserved(emptyObservedModel(scope));
      setDeclared(emptyDeclaredModel(scope));
      return;
    }
    let active = true;
    void fetchObservedModel(topicId)
      .then((payload) => {
        if (!active) return;
        setObserved(payload.observed);
        setDeclared(payload.declared);
      })
      .catch(() => {
        // The rail is not the place to report a model fetch failure: the Data
        // model surface owns that message and would say it twice. An empty
        // canvas next to a surface that explains itself is the quieter truth.
        if (!active) return;
        setObserved(emptyObservedModel(scope));
        setDeclared(emptyDeclaredModel(scope));
      });
    return () => {
      active = false;
    };
  }, [topicId, reloadToken, scope]);

  // Pin adopts an observed ghost into the declared model; unpin needs the
  // declared id rather than the observed key, which is why the pinned lookup
  // returns the field and not a boolean. Both post to the routes the Data model
  // surface posts to, so the two surfaces cannot drift into disagreeing about
  // what pinning means.
  const handlePin = useCallback(
    (observedKey: string, kind: PinKind, parentObservedKey?: string) => {
      if (!topicId) return;
      const alreadyDeclared = declared.fields.find(
        (field) => field.provenance?.observedKey === observedKey,
      );
      setPendingPins((current) => [...current, observedKey]);
      const settle = () => {
        setPendingPins((current) => current.filter((pending) => pending !== observedKey));
        setReloadToken((token) => token + 1);
      };
      const pending = alreadyDeclared
        ? postUnpin(topicId, alreadyDeclared.id)
        : postPin({ scope, observedKey, kind, parentObservedKey });
      void pending.then(settle).catch(settle);
    },
    [topicId, declared, scope],
  );

  // Unpin arrives already carrying the declared id, so it does not need the
  // observed-key lookup above.
  const handleUnpin = useCallback(
    (declaredId: string) => {
      if (!topicId) return;
      setPendingPins((current) => [...current, declaredId]);
      const settle = () => {
        setPendingPins((current) => current.filter((pending) => pending !== declaredId));
        setReloadToken((token) => token + 1);
      };
      void postUnpin(topicId, declaredId).then(settle).catch(settle);
    },
    [topicId],
  );

  return (
    <div className="h-full min-h-0 w-full" data-rail-model-canvas>
      <ForkDiagramCanvas
        observed={observed}
        declared={declared}
        pendingPins={pendingPins}
        selection={selection}
        onSelect={setSelection}
        onPin={handlePin}
        onUnpin={handleUnpin}
        layoutPositions={positions}
        onLayoutChange={setPositions}
      />
      {/* Selection is controlled, so the canvas keeps what the reader clicked
          instead of forgetting it on the next render. The rail has no inspector
          body to show it in yet; the attribute is how an e2e check reads it
          without a bespoke test hook. */}
      <span hidden data-rail-selection={selection ? `${selection.kind}:${selection.key}` : ''} />
    </div>
  );
}
