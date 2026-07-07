'use client';

import { useEffect, useRef, useState } from 'react';
import { Command } from 'cmdk';
import {
  isSlashQuery,
  matchStageCommands,
  matchToolCommands,
  parseOmnibarSubmit,
  type StageCommand,
  type ToolCommand,
  type WorkStage,
  type WorkToolCommandName,
} from '@/lib/work-surface/omnibar';
import { fulltextQuery, queryObjects } from '@/lib/work-surface/object-client';
import type { ObjectRef } from '@/lib/block-view/types';
import styles from './work.module.css';

const SEARCH_DEBOUNCE_MS = 180;

function titleForObject(object: ObjectRef): string {
  const value = object.properties.title ?? object.properties.name ?? object.properties.display_title;
  return typeof value === 'string' && value.trim() ? value : object.id;
}

interface WorkOmnibarProps {
  onAsk: (text: string) => void;
  onOpenStage: (stage: WorkStage) => void;
  onRunTool: (tool: WorkToolCommandName, arg: string) => void;
  disabled?: boolean;
}

/**
 * The one input: a chat composer, a /board /doc /code stage switcher, and an
 * object search box, all in a single cmdk combobox (shouldFilter=false --
 * matching is either the pure prefix filter in omnibar.ts, or the server's
 * real fulltext ranker via /objects/query, never client-side re-filtering of
 * already-ranked results).
 */
export function WorkOmnibar({ onAsk, onOpenStage, onRunTool, disabled }: WorkOmnibarProps) {
  const [text, setText] = useState('');
  const [rawResults, setRawResults] = useState<readonly ObjectRef[]>([]);
  const [rawSearching, setRawSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slash = isSlashQuery(text);
  const stageMatches = slash ? matchStageCommands(text) : [];
  const toolMatches = slash ? matchToolCommands(text) : [];
  const trimmed = text.trim();
  const isSearchQuery = !slash && trimmed.length > 0;
  const dropdownOpen = slash ? stageMatches.length > 0 || toolMatches.length > 0 : trimmed.length > 0;
  // Stale results from a prior query are never shown once the query that
  // produced them is no longer active, without needing an effect-driven
  // reset (which would call setState synchronously inside the effect body).
  const results = isSearchQuery ? rawResults : [];
  const searching = isSearchQuery && rawSearching;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isSearchQuery) return;
    debounceRef.current = setTimeout(async () => {
      setRawSearching(true);
      try {
        const set = await queryObjects(fulltextQuery(trimmed));
        setRawResults(set.objects);
      } catch {
        setRawResults([]);
      } finally {
        setRawSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, isSearchQuery]);

  const commit = () => {
    const intent = parseOmnibarSubmit(text);
    if (intent.type === 'stage') {
      onOpenStage({ kind: intent.stage });
    } else if (intent.type === 'tool') {
      onRunTool(intent.tool, intent.arg);
    } else if (intent.text) {
      onAsk(intent.text);
    }
    setText('');
  };

  const selectStageCommand = (command: StageCommand) => {
    onOpenStage({ kind: command.stage });
    setText('');
  };

  const selectToolCommand = (command: ToolCommand) => {
    if (command.requiresArg) {
      // Keep the command in the input so the user can type the argument next.
      setText(`${command.command} `);
      return;
    }
    onRunTool(command.tool, '');
    setText('');
  };

  const selectObject = (object: ObjectRef) => {
    // Every stage today (WS4/WS5) renders against a Doc-stage Item; opening a
    // search result binds the stage to that object's id so WS6's collab-token
    // gate (kind === 'doc') resolves it. Non-doc objects open read-only until
    // their own stage renderer lands.
    onOpenStage({ kind: 'doc', itemId: object.id });
    setText('');
  };

  return (
    <div className={styles.omnibarWrap}>
      <Command shouldFilter={false} label="Work omnibar" className={styles.omnibar}>
        <Command.Input
          value={text}
          onValueChange={setText}
          disabled={disabled}
          placeholder="Ask Theseus, /board /doc /code, /recall /ping, or search objects..."
          className={styles.omnibarInput}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || dropdownOpen) return;
            event.preventDefault();
            commit();
          }}
        />
        {searching && <span aria-live="polite">Searching&hellip;</span>}

        {dropdownOpen && (
          <Command.List className={styles.dropdown}>
            {slash ? (
              <>
                {stageMatches.length > 0 && (
                  <Command.Group heading="Stages" className={styles.dropdownGroup}>
                    {stageMatches.map((command) => (
                      <Command.Item
                        key={command.command}
                        value={command.command}
                        onSelect={() => selectStageCommand(command)}
                        className={styles.dropdownItem}
                      >
                        <span className={styles.dropdownItemLabel}>{command.command}</span>
                        <span className={styles.dropdownItemHint}>{command.hint}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {toolMatches.length > 0 && (
                  <Command.Group heading="Tools" className={styles.dropdownGroup}>
                    {toolMatches.map((command) => (
                      <Command.Item
                        key={command.command}
                        value={command.command}
                        onSelect={() => selectToolCommand(command)}
                        className={styles.dropdownItem}
                      >
                        <span className={styles.dropdownItemLabel}>{command.command}</span>
                        <span className={styles.dropdownItemHint}>{command.hint}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            ) : (
              <Command.Group heading="Objects" className={styles.dropdownGroup}>
                {results.length === 0 && !searching && (
                  <Command.Empty className={styles.dropdownEmpty}>
                    No objects match &ldquo;{trimmed}&rdquo;. Press Enter to ask Theseus instead.
                  </Command.Empty>
                )}
                {results.map((object) => (
                  <Command.Item
                    key={object.id}
                    value={`${object.id} ${titleForObject(object)}`}
                    onSelect={() => selectObject(object)}
                    className={styles.dropdownItem}
                  >
                    <span className={styles.dropdownItemLabel}>{titleForObject(object)}</span>
                    <span className={styles.dropdownItemHint}>{object.type}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        )}
      </Command>
      <div className={styles.omnibarHint}>
        <code>/board</code> &middot; <code>/doc</code> &middot; <code>/code</code> to switch stages &middot;{' '}
        <code>/recall</code> &middot; <code>/ping</code> for tools
      </div>
    </div>
  );
}
