/* Settings (new tab, sits one above Account). For now it hosts Onboarding —
   the former harness-console "claim" flow, renamed (the word "claim" is dropped):
   a coding agent provisions its own key, a human claims it to an account later.
   The full multi-stage flow (choose / agent / signup) ports from
   apps/harness-console/(onboarding)/claim into a porcelain surface next. */

import Link from 'next/link';
import { Sparkles, KeyRound, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import styles from '../surface.module.css';

export default function SettingsPage() {
  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Settings</div>
          <h1 className="p-h1">Settings</h1>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <Sparkles className={styles.cardIcon} />
              <span className={styles.cardTitle}>Onboarding</span>
            </div>
            <p className={styles.cardHint}>
              Connect a coding agent to the graph-native memory + coordination substrate. An agent
              provisions its own key before there is an account; you claim it to your account later.
            </p>
            <Link className={styles.cardLink} href="/account/agents">
              Provision an agent key &rarr;
            </Link>
            <span className={styles.soon}>Full flow porting from console</span>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <KeyRound className={styles.cardIcon} />
              <span className={styles.cardTitle}>Keys &amp; providers</span>
            </div>
            <p className={styles.cardHint}>
              API keys and model-provider credentials live under your agents.
            </p>
            <Link className={styles.cardLink} href="/account/agents">
              Open Account / Agents &rarr;
            </Link>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <ShieldCheck className={styles.cardIcon} />
              <span className={styles.cardTitle}>Access &amp; identity</span>
            </div>
            <p className={styles.cardHint}>Your profile and connected accounts live under your user.</p>
            <Link className={styles.cardLink} href="/account/user">
              Open Account / User &rarr;
            </Link>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <SlidersHorizontal className={styles.cardIcon} />
              <span className={styles.cardTitle}>Workspace preferences</span>
            </div>
            <p className={styles.cardHint}>Theme, defaults, and surface configuration.</p>
            <span className={styles.soon}>Coming</span>
          </div>
        </div>
      </div>
    </>
  );
}
