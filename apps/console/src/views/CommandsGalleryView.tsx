'use client';

// SOURCING: cmdk Command for searchable published-command / monitor-template
// gallery (SPEC-COMMONPLACE-COMMANDS-AND-SENTINELS-1.0 D5). Fork is the
// primary action; validation receipts are listed inline.

import { useMemo, useState } from 'react';
import { Command } from 'cmdk';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { ViewState } from '../ViewStates';

export type GalleryKind = 'command' | 'monitor_template';

export interface GalleryEntry {
  readonly kind: GalleryKind;
  readonly slugOrName: string;
  readonly title: string;
  readonly summary: string;
  readonly programId?: string;
  readonly publicationRef?: string;
  readonly parentProgramId?: string;
  readonly validationPassed?: boolean;
  readonly validationChecks?: readonly string[];
}

const FIXTURE_GALLERY: readonly GalleryEntry[] = [
  {
    kind: 'monitor_template',
    slugOrName: 'Price watch',
    title: 'Price watch',
    summary: 'Watch a product page price and notify when it crosses a threshold.',
    programId: 'program:price-watch',
    validationPassed: true,
    validationChecks: ['program_identity', 'standing_budget', 'typed_stream_edges'],
  },
  {
    kind: 'monitor_template',
    slugOrName: 'Content watch',
    title: 'Content watch',
    summary: 'Watch a page body and notify when the content hash changes.',
    programId: 'program:content-watch',
    validationPassed: true,
    validationChecks: ['program_identity', 'standing_budget'],
  },
  {
    kind: 'monitor_template',
    slugOrName: 'Release watch',
    title: 'Release watch',
    summary: 'Watch a releases or changelog URL and notify plus capture on change.',
    programId: 'program:release-watch',
    validationPassed: true,
    validationChecks: ['program_identity', 'standing_budget'],
  },
];

function entriesFromHost(set: ViewRenderProps['set']): GalleryEntry[] {
  const fromHost = set.objects
    .filter((object) => object.properties.galleryKind || object.properties.kind === 'monitor_template')
    .map((object) => ({
      kind: (String(object.properties.galleryKind ?? 'monitor_template') as GalleryKind),
      slugOrName: String(object.properties.slug ?? object.properties.name ?? object.id),
      title: String(object.properties.title ?? object.properties.name ?? object.id),
      summary: String(object.properties.summary ?? object.properties.intent ?? ''),
      programId: object.properties.programId
        ? String(object.properties.programId)
        : undefined,
      publicationRef: object.properties.publicationRef
        ? String(object.properties.publicationRef)
        : undefined,
      parentProgramId: object.properties.parentProgramId
        ? String(object.properties.parentProgramId)
        : undefined,
      validationPassed:
        typeof object.properties.validationPassed === 'boolean'
          ? object.properties.validationPassed
          : true,
      validationChecks: Array.isArray(object.properties.validationChecks)
        ? object.properties.validationChecks.map(String)
        : [],
    }));
  return fromHost.length > 0 ? fromHost : [...FIXTURE_GALLERY];
}

export function CommandsGalleryView({ set, host }: ViewRenderProps) {
  const entries = useMemo(() => entriesFromHost(set), [set]);
  const [forked, setForked] = useState<string[]>([]);

  if (entries.length === 0) {
    return (
      <ViewState
        state="empty"
        emptyTitle="Command gallery"
        emptyDetail="Published commands and monitor templates appear here with validation receipts. Fork is the primary action."
      />
    );
  }

  return (
    <div data-commands-gallery className="flex h-full min-h-0 flex-col gap-2 p-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-[color:var(--ij-foreground)]">
          Commands and monitors
        </h2>
        <p className="text-xs text-[color:var(--ij-foreground-secondary)]">
          Published commands and forkable monitor templates. Validation receipts stay visible.
        </p>
      </header>
      <Command label="Command gallery" className="min-h-0 flex-1 overflow-auto border border-[color:var(--ij-divider)]">
        <Command.Input
          placeholder="Filter published commands and templates"
          className="w-full border-b border-[color:var(--ij-divider)] bg-transparent px-3 py-2 text-sm outline-none"
        />
        <Command.List>
          <Command.Empty>No published entries</Command.Empty>
          {entries.map((entry) => (
            <Command.Item
              key={`${entry.kind}:${entry.slugOrName}`}
              value={`${entry.title} ${entry.summary} ${entry.slugOrName}`}
              className="flex cursor-pointer flex-col gap-1 px-3 py-2 data-[selected=true]:bg-[color:var(--ij-selection)]"
              onSelect={() => {
                if (entry.kind !== 'monitor_template') {
                  return;
                }
                const forkName = `Fork of ${entry.title}`;
                setForked((current) => [...current, forkName]);
                void host.emit({
                  kind: 'invoke_tool',
                  tool: 'program.fork',
                  args: {
                    parentProgramId: entry.programId ?? '',
                    name: forkName,
                  },
                });
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{entry.title}</strong>
                <span className="text-[10px] uppercase tracking-wide text-[color:var(--ij-foreground-secondary)]">
                  {entry.kind === 'monitor_template' ? 'template' : 'command'}
                </span>
              </div>
              <p className="text-xs text-[color:var(--ij-foreground-secondary)]">{entry.summary}</p>
              <div className="flex flex-wrap gap-2 text-[10px] text-[color:var(--ij-foreground-secondary)]">
                <span>
                  validation: {entry.validationPassed === false ? 'failed' : 'passed'}
                </span>
                {entry.publicationRef ? <span>pub {entry.publicationRef}</span> : null}
                {entry.parentProgramId ? <span>lineage {entry.parentProgramId}</span> : null}
                {entry.kind === 'monitor_template' ? <span>Fork</span> : null}
              </div>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
      {forked.length > 0 ? (
        <p className="text-xs text-[color:var(--ij-foreground-secondary)]">
          Forked: {forked.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
