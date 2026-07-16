/* Account / User: user-level identity and connected accounts. The agent-scoped
   surfaces (memory, skills, runs, inbox, keys, providers, usage) live under the
   Agents subpage instead. Content wires to the account backend next. */

import { UserCircle, Link2, Bell } from '@/lib/icons';
import styles from '../../surface.module.css';

const USER_SURFACES = [
  {
    icon: UserCircle,
    title: 'Profile & identity',
    hint: 'Your name, avatar, and sign-in. The human who claims the agents.',
  },
  {
    icon: Link2,
    title: 'Connections',
    hint: 'Connected external accounts (GitHub and other OAuth links) at the user level.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    hint: 'How and when the workspace reaches you.',
  },
];

export default function AccountUserPage() {
  return (
    <div className={styles.grid}>
      {USER_SURFACES.map(({ icon: Icon, title, hint }) => (
        <div className={styles.card} key={title}>
          <div className={styles.cardHead}>
            <Icon className={styles.cardIcon} />
            <span className={styles.cardTitle}>{title}</span>
          </div>
          <p className={styles.cardHint}>{hint}</p>
          <span className={styles.soon}>Porting from console</span>
        </div>
      ))}
    </div>
  );
}
