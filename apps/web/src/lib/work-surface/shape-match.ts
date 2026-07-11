/**
 * Pure ObjectShapeMatch interpreter (SPEC-OBJECT-CONTRACT-V2).
 *
 * `BlockHost.viewsFor(shape)` is expected to return only the ViewDescriptors
 * that can actually render a given ObjectShape. The commonplace-api's own
 * `/objects/views` catalog ships every descriptor with an `accepts` match
 * clause but does no shape filtering itself (it is a static catalog fetch,
 * not a per-shape query), so WS3's WorkBlockHost does the filtering
 * client-side. No existing helper does this narrowing, so it is written
 * here as a small, fully pure, fully tested interpreter of the documented
 * ObjectShapeMatch contract (not a fabricated rule set).
 */

import type { ObjectShape, ObjectShapeMatch, ShapeRelation, ViewDescriptor } from '@/lib/block-view/types';

export function matchesShape(match: ObjectShapeMatch, shape: ObjectShape): boolean {
  if (match.cardinality && match.cardinality !== 'any' && match.cardinality !== shape.cardinality) {
    return false;
  }

  if (match.required_types && !match.required_types.every((type) => shape.types.includes(type))) {
    return false;
  }

  if (match.required_fields && !match.required_fields.every((field) => shape.fields.includes(field))) {
    return false;
  }

  if (match.required_axes) {
    const axesOk = Object.entries(match.required_axes).every(([key, required]) => {
      if (!required) return true;
      return Boolean(shape.axes[key as keyof typeof shape.axes]);
    });
    if (!axesOk) return false;
  }

  if (match.requires_relation && shape.relations.length === 0) {
    return false;
  }

  if (match.required_edge && !shape.relations.some((relation) => relationMatches(match.required_edge!, relation))) {
    return false;
  }

  return true;
}

function relationMatches(
  required: NonNullable<ObjectShapeMatch['required_edge']>,
  relation: ShapeRelation,
): boolean {
  if (required.edge && required.edge !== relation.edge) return false;
  if (required.dir && required.dir !== relation.dir) return false;
  if (required.target && required.target !== relation.target) return false;
  return true;
}

/** First catalog view (in server-supplied order) whose `accepts` clause matches the shape, or null. */
export function pickView(
  views: readonly ViewDescriptor[],
  shape: ObjectShape,
): ViewDescriptor | null {
  return views.find((view) => matchesShape(view.accepts, shape)) ?? null;
}
