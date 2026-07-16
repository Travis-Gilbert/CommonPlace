/* Account / Agents: the migrated harness-console surfaces that describe what the
   agents know, do, and cost. Memory / Skills / Runs / Inbox / Keys / Providers /
   Usage all port here (almost everything from the old console lands under Agents).

   Backend truth: in harness-console these reads were served by the mock client
   (`liveClient = { ...mockClient }`) — they were never live-wired. Making them
   live requires ADDING resolvers to the canonical harness GraphQL
   (rustyred-thg-mcp/src/graphql), then a fixture->live seam per surface. Each
   card below is a real surface target; its data binds as that lands. */

import { Brain, Sparkles, History, KeyRound, Cpu, Gauge } from '@/lib/icons';
import styles from '../../surface.module.css';

const AGENT_SURFACES = [
  {
    icon: Brain,
    title: 'Memory',
    hint: 'The agents’ durable atoms: decisions, feedback, solutions, postmortems. List, search, graph, and edit.',
  },
  {
    icon: Sparkles,
    title: 'Skills',
    hint: 'Authored SKILL.md packs the agents can publish and apply.',
  },
  {
    icon: History,
    title: 'Runs',
    hint: 'Composed-agent run history and the ordered event ledger, with replay.',
  },
  {
    icon: KeyRound,
    title: 'Keys',
    hint: 'API keys the agents authenticate with. Provision, scope, and revoke.',
  },
  {
    icon: Cpu,
    title: 'Providers',
    hint: 'Model-provider credentials and validation status.',
  },
  {
    icon: Gauge,
    title: 'Usage',
    hint: 'Token and request usage per period across the agents.',
  },
];

export default function AccountAgentsPage() {
  return (
    <div className={styles.grid}>
      {AGENT_SURFACES.map(({ icon: Icon, title, hint }) => (
        <div className={styles.card} key={title}>
          <div className={styles.cardHead}>
            <Icon className={styles.cardIcon} />
            <span className={styles.cardTitle}>{title}</span>
          </div>
          <p className={styles.cardHint}>{hint}</p>
          <span className={styles.soon}>Porting &middot; needs GraphQL resolver</span>
        </div>
      ))}
    </div>
  );
}
