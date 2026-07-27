// SOURCING: barrel for installed registry sources outside @jalco
// (SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC1). The records surface keeps the
// virtualized tanstack shell; the full @tnks/data-table install lives under
// components/data-table for SC6 index adoption.

export { TnksDataTable, type TnksDataTableProps } from './tnks-data-table';

export {
  LinearCombobox,
  type LinearComboboxProps,
  type LinearPriority,
  type LinearPriorityValue,
} from './linear-combobox';

export { PdfxDocument, type PdfxDocumentProps } from './pdfx-document';

export { CommandMenu, type CommandMenuItem, type CommandMenuProps } from './command-menu';
