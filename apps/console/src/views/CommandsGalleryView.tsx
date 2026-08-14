'use client';

// SOURCING: cmdk Command for searchable published-command / monitor-template
// gallery (SPEC-COMMONPLACE-COMMANDS-AND-SENTINELS-1.0 D5). Fork goes through
// programmable_graph `gallery` / `gallery_fork` (not orphan program.fork).

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { softNavigate } from '@/lib/soft-navigate';
import { ViewState } from './ViewStates';
import {
  canForkGalleryEntry,
  fetchCommandGallery,
  forkGalleryEntry,
  type CommandGalleryEntry,
} from './program/programClient';

export type GalleryKind = CommandGalleryEntry['kind'];
export type GalleryEntry = CommandGalleryEntry;

function entriesFromHost(set: ViewRenderProps['set']): GalleryEntry[] {
  return set.objects
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
      source: 'substrate' as const,
    }));
}

export function CommandsGalleryView({ set }: ViewRenderProps) {
  const router = useRouter();
  const hostEntries = useMemo(() => entriesFromHost(set), [set]);
  const [entries, setEntries] = useState<readonly GalleryEntry[]>(hostEntries);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forked, setForked] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        if (hostEntries.length > 0) {
          if (!cancelled) {
            setEntries(hostEntries);
            setSourceNote('Host objects');
          }
          return;
        }
        const gallery = await fetchCommandGallery();
        if (cancelled) return;
        setEntries(gallery);
        const fromStandIn = gallery.some((entry) => entry.source === 'LocalDevCommandGallery');
        setSourceNote(
          fromStandIn
            ? 'LocalDevCommandGallery stand-in (substrate gallery empty or unreachable)'
            : 'programmable_graph gallery',
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hostEntries]);

  async function forkEntry(entry: GalleryEntry): Promise<void> {
    if (!canForkGalleryEntry(entry)) {
      if (entry.source === 'LocalDevCommandGallery') {
        setError('Forking is disabled for local stand-in monitor templates (requires live substrate).');
      }
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await forkGalleryEntry(entry);
      setForked((current) => [...current, result.program.name || `Fork of ${entry.title}`]);
      if (typeof window !== 'undefined') {
        window.location.assign(result.nodeId ? result.href : '/program');
        return;
      }
      await softNavigate(router, '/program', { timeoutMs: 3_000, hardFallback: true });
    } catch (forkError) {
      setError(forkError instanceof Error ? forkError.message : String(forkError));
    } finally {
      setBusy(false);
    }
  }

  if (!busy && entries.length === 0) {
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
        <h2 className="text-sm font-semibold text-ij-ink">
          Commands and monitors
        </h2>
        <p className="text-xs text-ij-ink-info">
          Published commands and forkable monitor templates. Validation receipts stay visible.
        </p>
        {sourceNote ? <p className="text-xs text-ij-ink-info">{sourceNote}</p> : null}
        {error ? <p className="text-xs text-ij-danger" role="alert">{error}</p> : null}
      </header>
      <Command label="Command gallery" className="min-h-0 flex-1 overflow-auto border border-ij-seam">
        <Command.Input
          placeholder="Filter published commands and templates"
          className="w-full border-b border-ij-seam bg-transparent px-3 py-2 text-sm outline-none"
        />
        <Command.List>
          <Command.Empty>{busy ? 'Loading gallery…' : 'No published entries'}</Command.Empty>
          {entries.map((entry) => (
            <Command.Item
              key={`${entry.kind}:${entry.slugOrName}`}
              value={`${entry.title} ${entry.summary} ${entry.slugOrName}`}
              disabled={busy}
              data-gallery-kind={entry.kind}
              data-gallery-forkable={canForkGalleryEntry(entry) ? 'true' : 'false'}
              className="flex cursor-pointer flex-col gap-1 px-3 py-2 data-[selected=true]:bg-ij-selection data-[disabled=true]:opacity-50"
              onSelect={() => {
                void forkEntry(entry);
              }}
            >
              <div
                className="flex items-center justify-between gap-2"
                data-gallery-kind={entry.kind}
                data-gallery-forkable={canForkGalleryEntry(entry) ? 'true' : 'false'}
              >
                <strong className="text-sm">{entry.title}</strong>
                <span className="text-xs uppercase tracking-wide text-ij-ink-info">
                  {entry.kind === 'monitor_template' ? 'template' : 'command'}
                </span>
              </div>
              <p className="text-xs text-ij-ink-info">{entry.summary}</p>
              <div className="flex flex-wrap gap-2 text-xs text-ij-ink-info">
                <span>
                  validation: {entry.validationPassed === false ? 'failed' : 'passed'}
                </span>
                {entry.publicationRef ? <span>pub {entry.publicationRef}</span> : null}
                {entry.parentProgramId ? <span>lineage {entry.parentProgramId}</span> : null}
                {canForkGalleryEntry(entry) ? <span>Fork</span> : null}
                {entry.source === 'LocalDevCommandGallery' ? <span>stand-in</span> : null}
              </div>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
      {forked.length > 0 ? (
        <p className="text-xs text-ij-ink-info">
          Forked via gallery_fork: {forked.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
