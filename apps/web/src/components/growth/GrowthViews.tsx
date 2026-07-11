'use client';

import { useState } from 'react';
import { Eye, GitBranch, History, Link2, LockKeyhole } from 'lucide-react';
import type { GrowthListing, GrowthStamp, GrowthStats, GrowthTimelinePoint } from '@/lib/growth';
import styles from './growth.module.css';

export function GrowthTimeline({ timeline }: { readonly timeline: GrowthTimelinePoint[] }) {
  const [position, setPosition] = useState(Math.max(timeline.length - 1, 0));
  const point = timeline[position];
  if (!point) return <EmptyState title="No retained lineage commits yet" />;

  return (
    <section className={styles.panel} aria-labelledby="growth-timeline-title">
      <div className={styles.panelHeader}>
        <div><span className={styles.eyebrow}>Retained history</span><h2 id="growth-timeline-title">Timeline scrollback</h2></div>
        <small>{timeline.length} commits</small>
      </div>
      <div className={styles.timelineTrack}>
        <label htmlFor="growth-timeline-range" className="sr-only">Selected lineage commit</label>
        <input
          id="growth-timeline-range"
          type="range"
          min={0}
          max={Math.max(timeline.length - 1, 0)}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
        />
        <div className={styles.timelineBeats} aria-label="Lineage commits">
          {timeline.map((entry, index) => (
            <button
              key={entry.commitHash}
              type="button"
              data-active={index === position || undefined}
              data-beat={entry.beats[0] ?? 'observation'}
              aria-label={`Open commit ${entry.commitHash.slice(0, 8)}, ${entry.beats.join(', ') || 'observation'}`}
              onClick={() => setPosition(index)}
            />
          ))}
        </div>
      </div>
      <article className={styles.timelineDetail} aria-live="polite">
        <div className={styles.commit}><History aria-hidden="true" /><code>{point.commitHash.slice(0, 12)}</code></div>
        <Metric label="XP at commit" value={point.xp.toLocaleString()} />
        <Metric label="Form" value={point.stats.form} />
        <Metric label="Levels held" value={String(point.contextLevels.length)} />
        <Metric label="Episodes" value={String(point.stats.episodeCount)} />
        {point.parentCommits.length > 1 ? <p><GitBranch aria-hidden="true" /> Branch point with {point.parentCommits.length} parents</p> : null}
      </article>
    </section>
  );
}

export function GrowthStampView({ stamp }: { readonly stamp?: GrowthStamp }) {
  if (!stamp || stamp.emptyMark) {
    return <EmptyState title="No explicit connections" description="The empty Stamp remains visible." mark="∅" />;
  }
  const count = stamp.edges.length;
  return (
    <section className={styles.panel} aria-labelledby="growth-stamp-title">
      <div className={styles.panelHeader}>
        <div><span className={styles.eyebrow}>The Stamp</span><h2 id="growth-stamp-title">{count} explicit connections</h2></div>
        <small>Saved {new Date(stamp.savedAtMs).toLocaleString()}</small>
      </div>
      <div className={styles.stampGrid}>
        <div className={styles.stampMap} aria-hidden="true">
          <div className={styles.stampCenter}>Note</div>
          {stamp.edges.map((edge, index) => {
            const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
            return (
              <div
                key={edge.edgeId}
                className={styles.stampNode}
                data-class={edge.class}
                style={{ left: `${50 + Math.cos(angle) * 36}%`, top: `${50 + Math.sin(angle) * 34}%` }}
              >
                <Link2 aria-hidden="true" /><span>{edge.callout}</span><small>{edge.edgeType}</small>
              </div>
            );
          })}
        </div>
        <ol className={styles.stampCallouts} aria-label="Stamp relationship callouts">
          {stamp.edges.map((edge) => (
            <li key={edge.edgeId}><strong>{edge.callout}</strong><span>{edge.class} · {edge.edgeType}</span></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function GrowthMarketplace({ listing, viewer }: { readonly listing?: GrowthListing; readonly viewer: GrowthStats }) {
  if (!listing) return <EmptyState title="No public harness listings yet" description="Marketplace inspection remains read-only." />;
  const listedStats = listing.card.manifest.displayedStats;
  const listedLevels = new Map(listedStats.contextLevels.map((entry) => [entry.leaf, entry.level]));
  const shared = viewer.contextLevels.filter((entry) => listedLevels.has(entry.leaf));
  return (
    <section className={styles.panel} aria-labelledby="growth-marketplace-title">
      <div className={styles.panelHeader}>
        <div><span className={styles.eyebrow}>Read-only inspection</span><h2 id="growth-marketplace-title">{listedStats.form}</h2></div>
        <small><Eye aria-hidden="true" /> No transactions</small>
      </div>
      <div className={styles.marketplaceGrid}>
        <article>
          <h3>Public lineage</h3>
          <dl>
            <OptionalLineage label="Domains" values={listing.lineage.domainFamilies} />
            <OptionalLineage label="Languages" values={listing.lineage.dominantLanguages} />
            <OptionalLineage label="Worlds" values={listing.lineage.worldFamilies} />
            <OptionalLineage label="Skills" values={listing.lineage.mostExercisedSkills} />
          </dl>
          <small><LockKeyhole aria-hidden="true" /> Only opted-in aggregates</small>
        </article>
        <article>
          <h3>Shared contexts</h3>
          {shared.length === 0 ? <p>No shared public contexts.</p> : (
            <table className={styles.comparisonTable}>
              <thead><tr><th>Context</th><th>Your harness</th><th>{listedStats.form}</th></tr></thead>
              <tbody>{shared.map((entry) => <tr key={entry.leaf}><th scope="row">{formatLeaf(entry.leaf)}</th><td>L{entry.level}</td><td>L{listedLevels.get(entry.leaf)}</td></tr>)}</tbody>
            </table>
          )}
        </article>
      </div>
    </section>
  );
}

function OptionalLineage({ label, values }: { readonly label: string; readonly values: string[] | null }) {
  if (!values) return <div><dt>{label}</dt><dd>Not published</dd></div>;
  return <div><dt>{label}</dt><dd>{values.join(' · ') || 'Published empty'}</dd></div>;
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyState({ title, description, mark }: { readonly title: string; readonly description?: string; readonly mark?: string }) {
  return <section className={styles.emptyState}>{mark ? <span aria-hidden="true">{mark}</span> : null}<h2>{title}</h2>{description ? <p>{description}</p> : null}</section>;
}

function formatLeaf(leaf: string): string {
  return leaf.replaceAll('/', ' / ');
}
