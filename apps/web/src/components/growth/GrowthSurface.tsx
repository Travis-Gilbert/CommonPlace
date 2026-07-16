'use client';

import { BadgeCheck, Dna, LineChart, Network, ScanLine, Store } from '@/lib/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGrowthSnapshot } from '@/lib/growth';
import { GrowthCard } from './GrowthCard';
import { GrowthMathematics } from './GrowthMathematics';
import { GrowthMarketplace, GrowthStampView, GrowthTimeline } from './GrowthViews';
import styles from './growth.module.css';

const VIEWS = [
  { value: 'card', label: 'Card', icon: Dna },
  { value: 'timeline', label: 'Timeline', icon: LineChart },
  { value: 'mathematics', label: 'Mathematics', icon: Network },
  { value: 'stamp', label: 'Stamp', icon: ScanLine },
  { value: 'marketplace', label: 'Marketplace', icon: Store },
] as const;

export function GrowthSurface() {
  const state = useGrowthSnapshot();
  if (state.status === 'loading') return <GrowthLoading />;
  if (state.status === 'unavailable') return <GrowthUnavailable kind="unavailable" message={state.message} />;
  if (state.status === 'error') return <GrowthUnavailable kind="error" message={state.message} />;

  const { snapshot } = state;
  const topLevel = Math.max(0, ...snapshot.card.stats.contextLevels.map((entry) => entry.level));
  const topContext = snapshot.card.stats.contextLevels[0]?.leaf ?? 'No context levels yet';
  const readyCount = snapshot.readiness.filter((report) => report.ready).length;

  return (
    <div className={styles.route}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Harness / Growth</span>
          <h1>{snapshot.card.stats.form}</h1>
          <p>{snapshot.card.bundle.manifest.initialMessage}</p>
        </div>
        <div className={styles.source} data-state={state.stale ? 'stale' : 'live'} role="status">
          <i aria-hidden="true" />
          <span>{state.stale ? 'Live data stale' : 'Live substrate'}</span>
          <small>{new Date(snapshot.generatedAtMs).toLocaleString()}</small>
        </div>
      </header>

      <Tabs defaultValue="card" className={styles.tabs}>
        <TabsList className={styles.tabList} aria-label="Growth views">
          {VIEWS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className={styles.tabTrigger}>
              <Icon aria-hidden="true" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <section className={styles.statRibbon} aria-label="Current growth statistics">
          <Stat label="XP" value={snapshot.xp.total.toLocaleString()} detail={`+${snapshot.xp.sessionDelta} this session`} />
          <Stat label="Top level" value={String(topLevel)} detail={formatLeaf(topContext)} />
          <Stat label="Nature" value={snapshot.card.stats.natureBucket} detail="from fleet divergence" />
          <Stat label="Calibration" value={snapshot.card.stats.calibrationGrade} detail={`${snapshot.card.stats.episodeCount} episodes`} />
          <Stat label="Lineage" value={String(snapshot.card.stats.lineageDepth)} detail="retained commits" />
        </section>

        <TabsContent value="card" className={styles.tabPanel}>
          <div className={styles.cardView}>
            <GrowthCard card={snapshot.card} />
            <div className={styles.cardSide}>
              <section className={styles.panel} aria-labelledby="growth-readiness-title">
                <div className={styles.panelHeader}>
                  <div><span className={styles.eyebrow}>Level readiness</span><h2 id="growth-readiness-title">Current contexts</h2></div>
                  <strong className={styles.claimable}>{readyCount} claimable</strong>
                </div>
                <div className={styles.readinessList}>
                  {snapshot.readiness.length === 0 ? <p>No context readiness has been computed yet.</p> : snapshot.readiness.map((report) => {
                    const progress = Math.max(8, Math.min(100, (1 - report.ciWidth) * 100));
                    return (
                      <article key={report.leaf} className={styles.readiness} data-ready={report.ready || undefined}>
                        <div><strong>{formatLeaf(report.leaf)}</strong><small>L{report.levelCurrent}</small></div>
                        <div
                          className={styles.readinessBar}
                          role="progressbar"
                          aria-label={`${formatLeaf(report.leaf)} readiness`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progress)}
                        ><i style={{ width: `${progress}%` }} /></div>
                        <span>{report.ready ? 'Ready to claim' : report.failingPredicates[0] ?? 'Learning'}</span>
                      </article>
                    );
                  })}
                </div>
              </section>
              <section className={styles.panel} aria-labelledby="growth-skills-title">
                <div className={styles.panelHeader}>
                  <div><span className={styles.eyebrow}>Proven skills</span><h2 id="growth-skills-title">Unlocked by evidence</h2></div>
                  <BadgeCheck aria-hidden="true" />
                </div>
                <dl className={styles.skills}>
                  {snapshot.card.stats.skills.length === 0 ? <div><dt>No proven skills yet</dt><dd>Learning continues</dd></div> : snapshot.card.stats.skills.map((skill) => (
                    <div key={skill.name}><dt>{skill.name}</dt><dd>{skill.unlockedAt}</dd></div>
                  ))}
                </dl>
              </section>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="timeline" className={styles.tabPanel}><GrowthTimeline timeline={snapshot.timeline} /></TabsContent>
        <TabsContent value="mathematics" className={styles.tabPanel}><GrowthMathematics snapshot={snapshot} /></TabsContent>
        <TabsContent value="stamp" className={styles.tabPanel}><GrowthStampView stamp={snapshot.stamps[0]} /></TabsContent>
        <TabsContent value="marketplace" className={styles.tabPanel}><GrowthMarketplace listing={snapshot.listings[0]} viewer={snapshot.card.stats} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, detail }: { readonly label: string; readonly value: string; readonly detail: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function GrowthLoading() {
  return <div className={styles.state} role="status"><Dna aria-hidden="true" /><h1>Growth</h1><p>Reading the posterior and signed lineage.</p></div>;
}

function GrowthUnavailable({ kind, message }: { readonly kind: 'unavailable' | 'error'; readonly message: string }) {
  return (
    <div className={styles.state} role={kind === 'error' ? 'alert' : 'status'}>
      <Dna aria-hidden="true" />
      <h1>{kind === 'error' ? 'Growth data could not be read' : 'Growth data unavailable'}</h1>
      <p>{message}</p>
      <small>The surface retries the canonical GraphQL edge every three seconds.</small>
    </div>
  );
}

function formatLeaf(leaf: string): string {
  return leaf.replaceAll('/', ' / ');
}
