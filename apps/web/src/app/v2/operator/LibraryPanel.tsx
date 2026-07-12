'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import {
  libraryRecords,
  runLibraryAction,
  unwrapGraphqlField,
  type LibraryRecord,
  type LibraryRefreshPolicy,
  type LibraryActionResult,
} from '@/lib/theorem-libraries';
import styles from './operator.module.css';

const DEFAULT_QUERY = '{"limit": 8}';

export function LibraryPanel() {
  const [libraries, setLibraries] = useState<LibraryRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [queryText, setQueryText] = useState(DEFAULT_QUERY);
  const [refreshPolicy, setRefreshPolicy] = useState<LibraryRefreshPolicy>('none');
  const [queryResult, setQueryResult] = useState<unknown>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'load' | 'create' | 'query' | null>(null);

  const loadLibraries = useCallback(async () => {
    setBusy('load');
    const result = await runLibraryAction({ action: 'list' }).catch((cause: unknown): LibraryActionResult => ({
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    }));
    if (!result.ok) {
      setError(result.error ?? 'Libraries unavailable.');
      setBusy(null);
      return;
    }
    const records = libraryRecords(result.data);
    setLibraries(records);
    setSelectedId((current) => current || records[0]?.id || '');
    setError('');
    setBusy(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fetch resolves asynchronously.
    void loadLibraries();
  }, [loadLibraries]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const rootUrl = String(form.get('rootUrl') ?? '').trim();
    setBusy('create');
    const result = await runLibraryAction({
      action: 'create',
      config: {
        id: slug(name),
        name,
        rootUrl,
        maxPages: Number(form.get('maxPages')),
        maxDepth: Number(form.get('maxDepth')),
        includeUrlRules: lines(form.get('includeRules')),
        excludeUrlRules: lines(form.get('excludeRules')),
        renderMode: String(form.get('renderMode')) === 'browser' ? 'browser' : 'fetch',
        refreshPolicy,
        refreshSchedule: refreshPolicy === 'cron'
          ? String(form.get('refreshSchedule')) as 'hourly' | 'daily' | 'weekly' | 'monthly'
          : undefined,
      },
    }).catch((cause: unknown): LibraryActionResult => ({
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    }));
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Library creation failed.');
      return;
    }
    toast.success(`${name} configured`);
    setSelectedId(slug(name));
    await loadLibraries();
  }

  async function handleQuery() {
    if (!selectedId) return;
    let query: Record<string, unknown>;
    try {
      query = JSON.parse(queryText) as Record<string, unknown>;
    } catch {
      setError('Query input must be valid JSON.');
      return;
    }
    setBusy('query');
    const result = await runLibraryAction({ action: 'query', libraryId: selectedId, query }).catch(
      (cause: unknown): LibraryActionResult => ({ ok: false, error: cause instanceof Error ? cause.message : String(cause) }),
    );
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Library query failed.');
      return;
    }
    setError('');
    setQueryResult(unwrapGraphqlField(result.data, 'libraryQuery'));
  }

  return (
    <section className={styles.libraryPanel} aria-labelledby="library-panel-title">
      <div className={styles.libraryHead}>
        <div>
          <div className={styles.libraryEyebrow}>Web knowledge</div>
          <h2 id="library-panel-title" className={styles.libraryTitle}>Libraries</h2>
        </div>
        <span className={styles.libraryCount}>{libraries.length} configured</span>
      </div>

      {error && <div className={styles.libraryError} role="alert">{error}</div>}
      <div className={styles.libraryGrid}>
        <form className={styles.libraryForm} onSubmit={handleCreate}>
          <label className={styles.libraryField}>Name<input name="name" required placeholder="Product docs" /></label>
          <label className={styles.libraryField}>Root URL<input name="rootUrl" required type="url" placeholder="https://docs.example.com/" /></label>
          <div className={styles.libraryPair}>
            <label className={styles.libraryField}>Page cap<input name="maxPages" type="number" min="1" max="1000" defaultValue="100" /></label>
            <label className={styles.libraryField}>Depth cap<input name="maxDepth" type="number" min="0" max="10" defaultValue="3" /></label>
          </div>
          <div className={styles.libraryPair}>
            <label className={styles.libraryField}>Rendering<select name="renderMode" defaultValue="fetch"><option value="fetch">Fetch</option><option value="browser">Browser</option></select></label>
            <label className={styles.libraryField}>Refresh<select name="refreshPolicy" value={refreshPolicy} onChange={(event) => setRefreshPolicy(event.target.value as LibraryRefreshPolicy)}><option value="none">Manual</option><option value="cron">Scheduled</option><option value="on_change">On change</option></select></label>
          </div>
          <label className={styles.libraryField}>Schedule<select name="refreshSchedule" defaultValue="daily" disabled={refreshPolicy !== 'cron'}><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
          <label className={styles.libraryField}>Include rules<textarea name="includeRules" rows={2} placeholder="One glob per line" /></label>
          <label className={styles.libraryField}>Exclude rules<textarea name="excludeRules" rows={2} placeholder="*/private/*" /></label>
          <button className={styles.libraryPrimary} disabled={busy !== null}>{busy === 'create' ? 'Creating…' : 'Create library'}</button>
        </form>

        <div className={styles.libraryResults}>
          <div className={styles.libraryList} aria-label="Configured libraries">
            {busy === 'load' && libraries.length === 0 && <div className={styles.libraryEmpty}>Reading substrate…</div>}
            {!busy && libraries.length === 0 && !error && <div className={styles.libraryEmpty}>No libraries configured.</div>}
            {libraries.map((library) => (
              <button key={library.id} type="button" className={styles.libraryRow} data-active={selectedId === library.id || undefined} onClick={() => setSelectedId(library.id)}>
                <span><strong>{library.name}</strong><small>{library.rootUrl}</small></span>
                <span className={styles.libraryPolicy}>{library.refreshPolicy.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
          <div className={styles.libraryQuery}>
            <div className={styles.libraryQueryHead}><span>Query selected library</span><code>{selectedId || 'none'}</code></div>
            <textarea value={queryText} onChange={(event) => setQueryText(event.target.value)} rows={4} aria-label="Library query JSON" />
            <button type="button" className={styles.librarySecondary} disabled={!selectedId || busy !== null} onClick={() => void handleQuery()}>{busy === 'query' ? 'Querying…' : 'Run query'}</button>
            {queryResult !== undefined && <pre className={styles.libraryOutput}>{JSON.stringify(queryResult, null, 2)}</pre>}
          </div>
        </div>
      </div>
    </section>
  );
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '');
}
