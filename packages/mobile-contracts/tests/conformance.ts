import approvalRequestFixture from '../fixtures/approval_request.json';
import attentionItemFixture from '../fixtures/attention_item.json';
import contextLensFixture from '../fixtures/context_lens.json';
import contractCatalogFixture from '../fixtures/contract_catalog.json';
import controlLeaseFixture from '../fixtures/control_lease.json';
import fieldDefinitionFixture from '../fixtures/field_definition.json';
import graphNeighborhoodFixture from '../fixtures/graph_neighborhood.json';
import objectTypeFixture from '../fixtures/object_type.json';
import remoteSurfaceTokenFixture from '../fixtures/remote_surface_token.json';
import resumePageFixture from '../fixtures/resume_page.json';
import runEventFixture from '../fixtures/run_event.json';
import semanticFrameFixture from '../fixtures/semantic_frame.json';
import snapshotWithTailFixture from '../fixtures/snapshot_with_tail.json';
import viewDefinitionFixture from '../fixtures/view_definition.json';

import type {
  ApprovalRequest,
  AttentionItem,
  ContextLens,
  ContractDescriptor,
  ControlLease,
  FieldDefinition,
  GraphNeighborhood,
  ObjectType,
  RelationDefinition,
  RemoteSurfaceToken,
  ResumePage,
  RunEvent,
  SemanticFrame,
  SnapshotWithTail,
  ViewDefinition,
} from '../src/index';

function expectType<T>(_value: T): void {}

function asRunEvent(
  event: Omit<RunEvent, 'kind'> & { kind: string },
): RunEvent {
  return {
    ...event,
    kind: event.kind as RunEvent['kind'],
  };
}

function asFieldDefinition(
  field: Omit<FieldDefinition, 'fieldType' | 'sensitivity'> & {
    fieldType: object;
    sensitivity: string;
  },
): FieldDefinition {
  return {
    ...field,
    fieldType: field.fieldType as FieldDefinition['fieldType'],
    sensitivity: field.sensitivity as FieldDefinition['sensitivity'],
  };
}

expectType<RunEvent>(asRunEvent(runEventFixture));
expectType<ResumePage>({
  ...resumePageFixture,
  events: resumePageFixture.events.map(asRunEvent),
});
expectType<SnapshotWithTail>({
  ...snapshotWithTailFixture,
  events: snapshotWithTailFixture.events.map(asRunEvent),
});
expectType<AttentionItem>({
  ...attentionItemFixture,
  source: attentionItemFixture.source as AttentionItem['source'],
  risk: attentionItemFixture.risk as NonNullable<AttentionItem['risk']>,
});
expectType<ApprovalRequest>({
  ...approvalRequestFixture,
  risk: approvalRequestFixture.risk as ApprovalRequest['risk'],
  status: approvalRequestFixture.status as ApprovalRequest['status'],
});
expectType<RemoteSurfaceToken>({
  ...remoteSurfaceTokenFixture,
  allowedMode: remoteSurfaceTokenFixture.allowedMode as RemoteSurfaceToken['allowedMode'],
  maxRisk: remoteSurfaceTokenFixture.maxRisk as RemoteSurfaceToken['maxRisk'],
  surfaceKind: remoteSurfaceTokenFixture.surfaceKind as RemoteSurfaceToken['surfaceKind'],
});
expectType<SemanticFrame>(semanticFrameFixture);
expectType<ControlLease>({
  ...controlLeaseFixture,
  mode: controlLeaseFixture.mode as ControlLease['mode'],
});
expectType<FieldDefinition>(asFieldDefinition(fieldDefinitionFixture));
expectType<ObjectType>({
  ...objectTypeFixture,
  enforcement: objectTypeFixture.enforcement as ObjectType['enforcement'],
  fields: objectTypeFixture.fields.map(asFieldDefinition),
  relations: objectTypeFixture.relations.map((relation): RelationDefinition => ({
    ...relation,
    cardinality: relation.cardinality as RelationDefinition['cardinality'],
  })),
});
expectType<ViewDefinition>({
  ...viewDefinitionFixture,
  origin: viewDefinitionFixture.origin as ViewDefinition['origin'],
  target: viewDefinitionFixture.target as ViewDefinition['target'],
  viewKind: viewDefinitionFixture.viewKind as ViewDefinition['viewKind'],
});
expectType<ContextLens>({
  ...contextLensFixture,
  sensitiveFieldPolicy: contextLensFixture.sensitiveFieldPolicy as ContextLens['sensitiveFieldPolicy'],
});
expectType<GraphNeighborhood>(graphNeighborhoodFixture);
expectType<ContractDescriptor[]>(contractCatalogFixture);
