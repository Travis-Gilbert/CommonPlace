'use client';

import ObjectRenderer, { type RenderableObject } from '../../objects/ObjectRenderer';
import type { SceneRendererProps } from '../types';
import type { SceneAtom } from '@/lib/scene-package';

export default function EvidenceBoardRenderer({
  scenePackage,
  validationReason,
}: SceneRendererProps) {
  const objects = scenePackage.atoms.map(renderableFromAtom);
  return (
    <div className="cp-scene-evidence-board">
      {validationReason && <div className="cp-scene-validation-reason">{validationReason}</div>}
      <div className="cp-scene-evidence-grid">
        {objects.map((object) => (
          <ObjectRenderer key={object.slug} object={object} variant="module" />
        ))}
      </div>
      {scenePackage.relations.length > 0 && (
        <div className="cp-scene-relation-list">
          {scenePackage.relations.slice(0, 8).map((relation) => (
            <span key={relation.id}>
              {relation.sourceId} {relation.kind ?? 'related'} {relation.targetId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function renderableFromAtom(atom: SceneAtom, index: number): RenderableObject {
  const metadata = atom.metadata ?? {};
  const kind =
    readString(metadata.object_type_slug) ??
    readString(metadata.objectType) ??
    atom.kind ??
    'claim';
  const title = atom.label ?? readString(metadata.title) ?? atom.id;
  return {
    id: numericId(atom.id, index),
    slug: `scene-${atom.id}`,
    title,
    display_title: title,
    object_type_slug: kind,
    body: readString(metadata.body) ?? readString(metadata.summary) ?? readString(metadata.description),
    url: readString(metadata.url),
    score: typeof atom.weight === 'number' ? atom.weight : undefined,
    source_label: atom.sourceRefs?.[0]?.label,
  };
}

function numericId(value: string, fallback: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash || fallback + 1;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
