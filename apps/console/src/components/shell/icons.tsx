// SOURCING: Int UI icon set (JetBrains intellij-community, Apache 2.0).
// Ported as typed React glyphs with attribution; IntelliJ Community's
// license permits implementation porting. 16x16 viewBox, 1.5px strokes,
// currentColor ink so the register paints them. Every glyph in the chrome
// comes from this file; no icon library ships.

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

/** Tool window: records / data table. */
export function IconRecords(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 6.5h12M6.5 6.5V13" />
    </svg>
  );
}

/** Tool window: thread / chat. */
export function IconThread(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h8a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 11H6l-3 2.5v-9Z" />
    </svg>
  );
}

/** Run widget: play. */
export function IconRun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 3.5v9l7.5-4.5L5 3.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Stop square for the running state. */
export function IconStop(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Search everywhere. */
export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  );
}

/** Inspector / details panel. */
export function IconInspector(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M9.5 3v10" />
    </svg>
  );
}

/** Tool window: destination rail (Index surface). */
export function IconRail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 3.5h10M3 6.5h10M3 9.5h6M3 12.5h6" />
    </svg>
  );
}

/** Tool window: document list (Documents surface). */
export function IconDoc(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 2.5h5.5L12 5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
      <path d="M9.5 2.5V5H12" />
    </svg>
  );
}

/** Layout switcher chevron for the toolbar project widget. */
export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </svg>
  );
}
