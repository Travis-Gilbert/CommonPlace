import { UserCircle, Link2, Bell } from 'lucide-react';
import { auth, signIn, signOut } from '@/lib/auth';
import styles from '../../surface.module.css';

const SECONDARY_SURFACES = [
  {
    icon: Link2,
    title: 'Connections',
    hint: 'Claude.ai and other agents connect to the same GitHub-backed Harness identity.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    hint: 'How and when the workspace reaches you.',
  },
];

async function signInWithGithub() {
  'use server';
  await signIn('github', { redirectTo: '/account/user' });
}

async function signOutOfCommonPlace() {
  'use server';
  await signOut({ redirectTo: '/account/user' });
}

export default async function AccountUserPage() {
  const session = await auth();
  const user = session?.user;
  const login = user?.githubLogin;

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <UserCircle className={styles.cardIcon} />
          <span className={styles.cardTitle}>Profile &amp; identity</span>
        </div>
        {user ? (
          <>
            <p className={styles.cardHint}>
              Signed in{login ? ` as @${login}` : ''}. This identity owns your Harness workspace;
              changing your display name will not move your data.
            </p>
            <div className={styles.identityLine}>
              <span className={styles.identityName}>{user.name || login || 'GitHub account'}</span>
              <span className={styles.identityStatus}>Signed in</span>
            </div>
            <form action={signOutOfCommonPlace}>
              <button className={styles.secondaryAction} type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <>
            <p className={styles.cardHint}>
              Sign in with GitHub. The Harness uses that verified identity to create or reuse your
              workspace when you connect Claude.ai or another agent.
            </p>
            <form action={signInWithGithub}>
              <button className={styles.primaryAction} type="submit">Sign in with GitHub</button>
            </form>
          </>
        )}
      </div>

      {SECONDARY_SURFACES.map(({ icon: Icon, title, hint }) => (
        <div className={styles.card} key={title}>
          <div className={styles.cardHead}>
            <Icon className={styles.cardIcon} />
            <span className={styles.cardTitle}>{title}</span>
          </div>
          <p className={styles.cardHint}>{hint}</p>
          <span className={styles.soon}>{user ? 'Uses your signed-in identity' : 'Sign in first'}</span>
        </div>
      ))}
    </div>
  );
}
