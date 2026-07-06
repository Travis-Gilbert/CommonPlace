'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock3, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  ChatGlyph,
  CodeGlyph,
  CommonplacesGlyph,
  FilesGlyph,
  GraphGlyph,
  IndexGlyph,
  NotesGlyph,
  OperatorGlyph,
  ResearchGlyph,
  RowsGlyph,
  RustyRedGlyph,
  WorkroomsGlyph,
} from './brand-icons';
import { useV2Shell } from './V2Shell';

/* The rail is the two-product seam: HARNESS above (where you act),
   DATA below (what you both remember). Law of the surface: no counts,
   no badges, nothing red in the rail, ever. Items without a built route
   render inert until their surface exists. Collapses to an icon rail when a
   surface brings its own secondary rail; collapsed items keep a title tooltip. */

type RailItem = {
  label: string;
  href: string | null;
  icon: React.ComponentType<{ className?: string }>;
  indent?: boolean;
};

const HARNESS: RailItem[] = [
  { label: 'Chat', href: null, icon: ChatGlyph },
  { label: 'Index', href: '/v2', icon: IndexGlyph },
  { label: 'Commonplaces', href: null, icon: CommonplacesGlyph },
  { label: 'Workrooms', href: '/v2/workrooms', icon: WorkroomsGlyph, indent: true },
  { label: 'Operator', href: '/v2/operator', icon: OperatorGlyph, indent: true },
  { label: 'Notes', href: null, icon: NotesGlyph },
  { label: 'Research', href: null, icon: ResearchGlyph },
  { label: 'Code', href: null, icon: CodeGlyph },
];

const DATA: RailItem[] = [
  { label: 'Files', href: '/v2/files', icon: FilesGlyph },
  { label: 'Graph', href: '/v2/graph', icon: GraphGlyph },
  { label: 'Tables', href: '/v2/ledger', icon: RowsGlyph },
  { label: 'Timeline', href: '/v2/timeline', icon: Clock3 },
];

function NavItem({ item, active, collapsed }: { item: RailItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const cls = `p-navitem${item.indent ? ' is-child' : ''}`;
  if (!item.href) {
    return (
      <span className={`${cls} is-soon`} title={collapsed ? item.label : 'Not built yet'}>
        <Icon className="p-glyph" />
        {!collapsed && item.label}
      </span>
    );
  }
  return (
    <Link
      className={cls}
      data-active={active ? 'true' : undefined}
      href={item.href}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="p-glyph" />
      {!collapsed && item.label}
    </Link>
  );
}

export function Rail() {
  const pathname = usePathname();
  const { collapsed, toggle } = useV2Shell();

  return (
    <aside className="p-rail" data-collapsed={collapsed || undefined}>
      <div className="p-railtop">
        <div className="p-wordmark">
          {collapsed ? (
            <span className="p-mark">
              T<span className="p-r">H</span>
            </span>
          ) : (
            <>
              Theorem&rsquo;s
              <br />
              <span className="p-r">Harness</span>
            </>
          )}
        </div>
        <button
          type="button"
          className="p-railtoggle"
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="p-glyph" /> : <PanelLeftClose className="p-glyph" />}
        </button>
      </div>

      {!collapsed && <div className="p-sec">Harness</div>}
      {collapsed && <div className="p-raildiv" />}
      <nav className="p-nav" aria-label="Harness">
        {HARNESS.map((item) => (
          <NavItem key={item.label} item={item} active={item.href === pathname} collapsed={collapsed} />
        ))}
      </nav>

      {!collapsed && (
        <div className="p-sec">
          <RustyRedGlyph className="p-secmark" />
          Data
        </div>
      )}
      {collapsed && <div className="p-raildiv" />}
      <nav className="p-nav" aria-label="Data">
        {DATA.map((item) => (
          <NavItem key={item.label} item={item} active={item.href === pathname} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}
