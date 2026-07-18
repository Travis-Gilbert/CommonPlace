'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import {
  runTopicAction,
  topicRecords,
  unwrapGraphqlField,
  type TopicActionResult,
  type TopicRecord,
} from '@/lib/theorem-topics';
import styles from './operator.module.css';

export function TopicPanel() {
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [plan, setPlan] = useState<unknown>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'load' | 'create' | 'plan' | null>(null);

  const selected = useMemo(
    () => topics.find((topic) => topic.id === selectedId),
    [selectedId, topics],
  );

  const loadTopics = useCallback(async () => {
    setBusy('load');
    const result = await runTopicAction({ action: 'list' }).catch(resultFromError);
    if (!result.ok) {
      setError(result.error ?? 'Topics unavailable.');
      setBusy(null);
      return;
    }
    const records = topicRecords(result.data);
    setTopics(records);
    setSelectedId((current) => current || records[0]?.id || '');
    setError('');
    setBusy(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fetch resolves asynchronously.
    void loadTopics();
  }, [loadTopics]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const seedUrls = lines(form.get('seedUrls'));
    const queries = lines(form.get('queries'));
    if (seedUrls.length === 0 && queries.length === 0) {
      setError('Add at least one seed URL or search query.');
      return;
    }
    setBusy('create');
    const result = await runTopicAction({
      action: 'create',
      config: {
        id: slug(name),
        name,
        intent: String(form.get('intent') ?? '').trim(),
        status: 'active',
        cadenceSeconds: Number(form.get('cadenceMinutes')) * 60,
        seedUrls,
        queries,
        allowedHosts: seedUrls.flatMap(hostname).filter(unique),
        maxDepth: Number(form.get('maxDepth')),
        maxItems: Number(form.get('maxItems')),
        maxBytes: 16 * 1024 * 1024,
        maxSeconds: 60,
        maxWorkUnits: 32,
      },
    }).catch(resultFromError);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Topic creation failed.');
      return;
    }
    toast.success(`${name} subscribed`);
    setSelectedId(slug(name));
    await loadTopics();
  }

  async function handlePlan() {
    if (!selectedId) return;
    setBusy('plan');
    const result = await runTopicAction({ action: 'plan', topicId: selectedId }).catch(resultFromError);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? 'Topic planning failed.');
      return;
    }
    setError('');
    setPlan(unwrapGraphqlField(result.data, 'topicWork'));
  }

  return (
    <section className={styles.libraryPanel} aria-labelledby="topic-panel-title">
      <div className={styles.libraryHead}>
        <div>
          <div className={styles.libraryEyebrow}>Standing knowledge</div>
          <h2 id="topic-panel-title" className={styles.libraryTitle}>Topics</h2>
        </div>
        <span className={styles.libraryCount}>{topics.length} subscribed</span>
      </div>

      {error && <div className={styles.libraryError} role="alert">{error}</div>}
      <div className={styles.libraryGrid}>
        <form className={styles.libraryForm} onSubmit={handleCreate}>
          <label className={styles.libraryField}>Name<input name="name" required placeholder="Rust databases" /></label>
          <label className={styles.libraryField}>What should stay current?<textarea name="intent" required rows={2} placeholder="Releases, architecture changes, and new projects" /></label>
          <label className={styles.libraryField}>Seed URLs<textarea name="seedUrls" rows={2} placeholder="https://example.com/research" /></label>
          <label className={styles.libraryField}>Search queries<textarea name="queries" rows={2} placeholder="rust database release" /></label>
          <div className={styles.libraryPair}>
            <label className={styles.libraryField}>Every (minutes)<input name="cadenceMinutes" type="number" min="1" defaultValue="60" required /></label>
            <label className={styles.libraryField}>Link depth<input name="maxDepth" type="number" min="0" max="32" defaultValue="2" /></label>
          </div>
          <label className={styles.libraryField}>Items per source<input name="maxItems" type="number" min="1" max="1000" defaultValue="100" required /></label>
          <button className={styles.libraryPrimary} disabled={busy !== null}>{busy === 'create' ? 'Subscribing…' : 'Subscribe to topic'}</button>
        </form>

        <div className={styles.libraryResults}>
          <div className={styles.libraryList} aria-label="Subscribed topics">
            {busy === 'load' && topics.length === 0 && <div className={styles.libraryEmpty}>Reading subscriptions…</div>}
            {!busy && topics.length === 0 && !error && <div className={styles.libraryEmpty}>No standing topics yet.</div>}
            {topics.map((topic) => (
              <button key={topic.id} type="button" className={styles.libraryRow} data-active={selectedId === topic.id || undefined} onClick={() => setSelectedId(topic.id)}>
                <span><strong>{topic.name}</strong><small>{topic.intent}</small></span>
                <span className={styles.libraryPolicy}>{topic.status}</span>
              </button>
            ))}
          </div>
          <div className={styles.libraryQuery}>
            <div className={styles.libraryQueryHead}><span>Subscription runtime</span><code>{selectedId || 'none'}</code></div>
            {selected ? (
              <div className={styles.topicMetrics}>
                <TopicMetric label="Cadence" value={selected.cadenceSeconds ? every(selected.cadenceSeconds) : 'Event only'} />
                <TopicMetric label="Documents" value={String(selected.documentCount)} />
                <TopicMetric label="Connectors" value={String(selected.connectorCount)} />
                <TopicMetric label="Destinations" value={String(selected.destinationCount)} />
                <TopicMetric label="Last run" value={relativeTime(selected.lastRunAtMs)} />
                <TopicMetric label="Next run" value={relativeTime(selected.nextRunAtMs)} />
                <TopicMetric label="Gate" value={selected.gateModelVersion ?? 'Lexical baseline'} />
                <TopicMetric label="Signals" value={String(selected.learningSignalCount)} />
                <TopicMetric label="Accept rate" value={percentage(selected.feedbackAcceptRate)} />
                <TopicMetric label="Holdout precision" value={percentage(selected.trainingPrecision)} />
                <TopicMetric label="Calibration error" value={percentage(selected.trainingCalibrationError)} />
                <TopicMetric label="Training" value={trainingResult(selected.trainingDecision, selected.lastTrainingAtMs)} />
              </div>
            ) : <div className={styles.libraryEmpty}>Select a topic to inspect its runtime.</div>}
            <button type="button" className={styles.librarySecondary} disabled={!selectedId || busy !== null} onClick={() => void handlePlan()}>{busy === 'plan' ? 'Planning…' : 'Preview next work'}</button>
            {plan !== undefined && <pre className={styles.libraryOutput}>{JSON.stringify(plan, null, 2)}</pre>}
          </div>
        </div>
      </div>
    </section>
  );
}

function TopicMetric({ label, value }: { label: string; value: string }) {
  return <div className={styles.topicMetric}><span>{label}</span><strong>{value}</strong></div>;
}

function resultFromError(cause: unknown): TopicActionResult {
  return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
}

function hostname(value: string): string[] {
  try { return [new URL(value).hostname]; } catch { return []; }
}

function unique(value: string, index: number, values: string[]): boolean {
  return values.indexOf(value) === index;
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '');
}

function every(seconds: number): string {
  if (seconds % 86_400 === 0) return `Every ${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `Every ${seconds / 3_600}h`;
  return `Every ${Math.round(seconds / 60)}m`;
}

function percentage(value?: number): string {
  return value === undefined ? 'Not trained' : String(Math.round(value * 100)) + '%';
}

function relativeTime(timestamp?: number): string {
  if (!timestamp) return 'Not yet';
  const delta = timestamp - Date.now();
  const magnitude = Math.abs(delta);
  const suffix = delta < 0 ? 'ago' : 'from now';
  if (magnitude < 60_000) return delta < 0 ? 'Just now' : 'Soon';
  if (magnitude < 3_600_000) return `${Math.round(magnitude / 60_000)}m ${suffix}`;
  if (magnitude < 86_400_000) return `${Math.round(magnitude / 3_600_000)}h ${suffix}`;
  return `${Math.round(magnitude / 86_400_000)}d ${suffix}`;
}

function trainingResult(decision?: string, timestamp?: number): string {
  if (!decision) return 'Not trained';
  const label = decision === 'promote' ? 'Promoted' : decision === 'keep_incumbent' ? 'Kept incumbent' : decision;
  return `${label} · ${relativeTime(timestamp)}`;
}
