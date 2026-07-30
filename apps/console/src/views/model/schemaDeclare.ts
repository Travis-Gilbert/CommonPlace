// SOURCING: none. Pure adapter from the live declared model to schema_declare.

import type {
  DeclaredModel,
  FieldMetadata,
  SchemaDeclareInput,
} from '@commonplace/data-model-contracts';

export function schemaDeclareInputForField(
  declared: DeclaredModel,
  fieldId: string,
  replacement: FieldMetadata,
): SchemaDeclareInput {
  const current = declared.fields.find((field) => field.id === fieldId);
  if (!current) throw new Error(`Declared field ${fieldId} is no longer available.`);
  const objectType = declared.objectTypes.find(
    (candidate) => candidate.id === current.objectTypeId,
  );
  if (!objectType) {
    throw new Error(`Parent object type ${current.objectTypeId} is no longer available.`);
  }
  const fields = declared.fields
    .filter((field) => field.objectTypeId === objectType.id)
    .map((field) => field.id === fieldId ? replacement : field)
    .map((field) => ({
      key: field.key,
      label: field.label,
      ...(field.description ? { description: field.description } : {}),
      fieldType: field.fieldType,
      required: field.required,
      system: Boolean(field.system),
    }));

  return {
    nameSingular: objectType.nameSingular,
    namePlural: objectType.namePlural,
    labelSingular: objectType.label,
    labelPlural: objectType.namePlural,
    ...(objectType.description ? { description: objectType.description } : {}),
    nodeLabel: objectType.nodeLabel ?? objectType.key,
    labelIdentifierField: objectType.labelIdentifierField === current.key
      ? replacement.key
      : objectType.labelIdentifierField,
    fields,
    enforcement: objectType.enforcement,
    system: objectType.system,
    expectedContentAnchor: objectType.contentAnchor,
  };
}
