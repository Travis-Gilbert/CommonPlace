'use client';

/* Account: your identity (User) and your agents' credentials/memory/usage
   (Agents). The old harness-console surfaces memory / skills / runs / inbox /
   keys / providers / usage port under Agents; user-level identity + connections
   live under User. This layout owns the header + the User/Agents sub-tabs; each
   subpage renders its own card grid. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '../surface.module.css';

const TABS = [
  { href: '/account/user', label: 'User' },
  { href: '/account/agents', label: 'Agents' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Account</div>
          <h1 className="p-h1">Account</h1>
        </div>
      </header>

      <div className={styles.wrap}>
        <nav className={styles.tabs} aria-label="Account sections">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.tab} ${pathname === tab.href ? styles.tabActive : ''}`}
              data-active={pathname === tab.href ? 'true' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </>
  );
}
