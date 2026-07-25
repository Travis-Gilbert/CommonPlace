'use client';

// SOURCING: none. Pure Index settings list for agent-mail aliases; mint/revoke
// call the consumer GraphQL door through a same-origin route. No upstream
// component models this surface.

import { useCallback, useEffect, useState } from 'react';

export type AgentAliasRow = {
  readonly alias: string;
  readonly address: string;
  readonly counterparty: string;
  readonly status: string;
};

type PaneState =
  | { readonly status: 'loading' }
  | { readonly status: 'unconfigured' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly aliases: AgentAliasRow[]; readonly domain: string };

async function fetchAliases(): Promise<{
  aliases: AgentAliasRow[];
  domain: string;
} | null> {
  const response = await fetch('/api/agent-address/aliases', {
    method: 'GET',
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`aliases ${response.status}`);
  }
  return (await response.json()) as { aliases: AgentAliasRow[]; domain: string };
}

export function AgentAliasPane() {
  const [state, setState] = useState<PaneState>({ status: 'loading' });
  const [alias, setAlias] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const data = await fetchAliases();
      if (!data) {
        setState({ status: 'unconfigured' });
        return;
      }
      setState({ status: 'ready', aliases: data.aliases, domain: data.domain });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'alias load failed',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mint = useCallback(async () => {
    if (!alias.trim() || !counterparty.trim()) return;
    setBusy(true);
    try {
      const response = await fetch('/api/agent-address/aliases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ alias: alias.trim(), counterparty: counterparty.trim() }),
      });
      if (!response.ok) {
        throw new Error(`mint ${response.status}`);
      }
      setAlias('');
      setCounterparty('');
      await refresh();
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'mint failed',
      });
    } finally {
      setBusy(false);
    }
  }, [alias, counterparty, refresh]);

  const revoke = useCallback(
    async (target: string) => {
      setBusy(true);
      try {
        const response = await fetch('/api/agent-address/aliases', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ alias: target }),
        });
        if (!response.ok) {
          throw new Error(`revoke ${response.status}`);
        }
        await refresh();
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'revoke failed',
        });
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return (
    <section
      data-agent-aliases
      className="border-t border-ij-seam bg-ij-editor px-2 py-3 font-ij-ui text-ij-ink"
    >
      <h2 className="mb-2 text-ij-ink">Agent aliases</h2>
      {state.status === 'loading' ? <p className="text-ij-ink-info">Loading aliases…</p> : null}
      {state.status === 'unconfigured' ? (
        <p className="text-ij-ink-info" data-agent-aliases-unconfigured>
          Connect CONSOLE_HARNESS_URL to mint aliases on the agent mail domain.
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="text-ij-warn" data-agent-aliases-error>
          {state.message}
        </p>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <p className="mb-2 text-ij-ink-info" data-agent-mail-domain>
            Domain {state.domain}
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
            <input
              data-agent-alias-input
              aria-label="Agent alias"
              className="h-ij-control rounded-ij-arc border border-ij-seam bg-ij-chrome px-2"
              placeholder="alias"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
            />
            <input
              data-agent-counterparty-input
              aria-label="Counterparty email"
              className="h-ij-control min-w-48 flex-1 rounded-ij-arc border border-ij-seam bg-ij-chrome px-2"
              placeholder="counterparty email"
              value={counterparty}
              onChange={(event) => setCounterparty(event.target.value)}
            />
            <button
              type="button"
              data-agent-alias-mint
              disabled={busy}
              onClick={() => void mint()}
              className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:text-ij-ink-disabled"
            >
              Mint
            </button>
          </div>
          {state.aliases.length === 0 ? (
            <p className="text-ij-ink-info" data-agent-aliases-empty>
              No aliases yet. Mint one per counterparty; revoke bounces further mail.
            </p>
          ) : (
            <ul data-agent-alias-list>
              {state.aliases.map((row) => (
                <li
                  key={row.alias}
                  data-agent-alias={row.alias}
                  className="flex items-baseline gap-2 border-b border-ij-seam py-1"
                >
                  <span className="truncate">{row.address}</span>
                  <span className="shrink-0 text-ij-ink-info">{row.counterparty}</span>
                  <span className="shrink-0 text-ij-ink-info">{row.status}</span>
                  {row.status === 'active' ? (
                    <button
                      type="button"
                      data-agent-alias-revoke={row.alias}
                      disabled={busy}
                      onClick={() => void revoke(row.alias)}
                      className="shrink-0 text-ij-warn"
                    >
                      Revoke
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
