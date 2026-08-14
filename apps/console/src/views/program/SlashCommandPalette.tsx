'use client';

// SOURCING: cmdk Command for the composer `/` palette (SPEC-COMMONPLACE-COMMANDS-AND-SENTINELS-1.0 D2).
// Param fields are labeled ProgramPort inputs. theorem-form is the pet renderer;
// it is not a CommonPlace package.

import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import type { ChatSessionController } from '@commonplace/theorem-chat-register';
import {
  fetchCommandPalette,
  filterPaletteCommands,
  invokePaletteCommand,
  type PaletteCommand,
} from '@/views/program/programClient';

export function SlashCommandPalette({
  draft,
  setDraft,
  appendLocal,
  hasSelection = false,
}: {
  readonly draft: string;
  readonly setDraft: (value: string) => void;
  readonly appendLocal?: ChatSessionController['appendLocal'];
  readonly hasSelection?: boolean;
}) {
  const query = draft.startsWith('/') ? draft.slice(1).trim() : null;
  const open = query !== null;
  const [commands, setCommands] = useState<readonly PaletteCommand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [pending, setPending] = useState<PaletteCommand | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchCommandPalette({ hasSelection })
      .then((rows) => {
        if (!cancelled) {
          setCommands(rows);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasSelection, open]);

  const visible = useMemo(() => {
    const filtered = filterPaletteCommands(commands, hasSelection);
    if (!query) return filtered;
    const needle = query.toLowerCase();
    return filtered.filter((command) =>
      `${command.slug} ${command.title} ${command.summary}`.toLowerCase().includes(needle),
    );
  }, [commands, hasSelection, query]);

  async function run(
    command: PaletteCommand,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      const result = await invokePaletteCommand(command.slug, params);
      const line =
        `${result.commandTitle} · ${result.receiptId} · ${result.resultStream.join(' ')}`.trim();
      setDraft('');
      setPending(null);
      setParamValues({});
      setReceipt(line);
      appendLocal?.('assistant', line);
    } catch (invokeError) {
      setError(invokeError instanceof Error ? invokeError.message : String(invokeError));
    }
  }

  function select(command: PaletteCommand): void {
    if (command.params.length === 0) {
      void run(command);
      return;
    }
    setPending(command);
    setParamValues(
      Object.fromEntries(command.params.map((param) => [param.id, ''])),
    );
    setError(null);
  }

  if (query === null && !receipt) return null;

  if (query === null) {
    return (
      <p className="text-xs text-ij-ink-info" data-command-receipt>
        {receipt}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Command label="Command palette" className="border border-ij-seam" data-slash-command-palette>
        <Command.List>
          <Command.Empty>No commands match.</Command.Empty>
          {visible.map((command) => (
            <Command.Item
              key={command.slug}
              value={`${command.slug} ${command.title}`}
              data-palette-slug={command.slug}
              onSelect={() => {
                select(command);
              }}
            >
              <strong>/{command.slug}</strong>
              <span className="text-xs text-ij-ink-info"> {command.title}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
      {pending ? (
        <div
          className="flex flex-col gap-2 border border-ij-seam p-2"
          data-command-param-form
        >
          <p className="text-xs text-ij-ink-info">/{pending.slug} parameters</p>
          {pending.params.map((param) => (
            <label key={param.id} className="flex flex-col gap-1 text-xs">
              {param.id}
              <input
                data-command-param={param.id}
                name={param.id}
                value={paramValues[param.id] ?? ''}
                onChange={(event) => {
                  setParamValues((current) => ({
                    ...current,
                    [param.id]: event.target.value,
                  }));
                }}
              />
            </label>
          ))}
          <button
            type="button"
            data-command-run
            onClick={() => {
              void run(pending, paramValues);
            }}
          >
            Run {pending.title}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-ij-danger" role="alert">{error}</p> : null}
      {receipt ? (
        <p className="text-xs text-ij-ink-info" data-command-receipt>
          {receipt}
        </p>
      ) : null}
    </div>
  );
}
