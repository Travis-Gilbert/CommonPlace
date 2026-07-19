// SOURCING: Noun Project licensed marks already held by this workspace's
// account. Canonical normalized SVGs and per-icon IDs live under
// src/assets/icons/noun. Product/domain glyphs use filled currentColor;
// small control primitives remain strokes because they are controls, not
// product taxonomy. The gate rejects hard-coded SVG paint.

import type { CSSProperties, SVGProps } from 'react';

export type IconDomain = 'memory' | 'agent' | 'room' | 'graph';
type IconProps = SVGProps<SVGSVGElement> & { size?: number; domain?: IconDomain };

function domainStyle(domain: IconDomain | undefined, style: CSSProperties | undefined): CSSProperties | undefined {
  return domain ? { color: `var(--ij-${domain})`, ...style } : style;
}

function nounBase({ size = 16, domain, style, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 1200 1200',
    fill: 'currentColor',
    'aria-hidden': true,
    focusable: false,
    'data-icon-domain': domain,
    style: domainStyle(domain, style),
    ...props,
  } as const;
}

function controlBase({ size = 16, domain: _domain, ...props }: IconProps) {
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
    focusable: false,
    ...props,
  };
}

/** "rows" (noun-rows-3097971): record/data stripe. */
export function IconRecords(props: IconProps) {
  return <svg {...nounBase(props)}><path d="m262.13 498.55-0.046874-141.05 547.01-315.81 128.77 74.281 0.046874 0.023437s-0.046874 726.55-0.046874 726.55l-547.02 315.82-128.71-74.246v-585.56zm54.617-109.48 0.058594 80.102 73.926 42.75 492.5-284.35 0.011719-80.066-73.984-42.727zm0.035156 143.13 0.023438 131.45 73.926 42.75 492.5-284.35 0.035156-131.43-492.43 284.3-74.055-42.727zm0.011719 194.48 0.011719 131.45 73.926 42.738 492.5-284.35 0.023437-131.41-492.41 284.29-74.043-42.727zm0 194.48 0.011719 131.44 73.926 42.75 492.5-284.35 0.011719-131.42-492.4 284.29-74.043-42.711z" /></svg>;
}

/** "chat / code window" (noun-7577030): thread stripe. */
export function IconThread(props: IconProps) {
  return (
    <svg {...nounBase(props)}>
      <path d="m690.94 727.31v109.12h36.375v-145.5h36.375v-36.375h-109.12v36.375h36.375z" />
      <path d="m618.19 690.94v-36.375h-36.375v72.75h36.375z" />
      <path d="m581.81 836.44h36.375v-72.75h-36.375z" />
      <path d="m545.44 800.06v-36.375h-36.375v72.75h36.375z" />
      <path d="m545.44 727.31h36.375v36.375h-36.375z" />
      <path d="m545.44 654.56h-36.375v72.75h36.375z" />
      <path d="m945.37 145.5h-36.375v36.375h-36.188v-36.375h36.188v-36.375h-36.188v-36.375h-509.26v109.12h-108.94v436.31h618.19v-36.375h-472.87v-472.69h436.5v109.12h108.94v763.5h-545.44v-72.75h472.87v-36.188h-618.19v254.44h654.37v-109.12h72.75v-836.26h-36.375zm-581.81 109.12v327.19h-72.562v-363.56h72.562zm509.26 799.87v36.375h-581.81v-181.87h72.562v109.12h509.26z" />
      <path d="m872.81 690.94v181.87h36.188v-254.63h-36.188z" />
      <path d="m399.94 727.31v109.12h36.375v-145.5h36.375v-36.375h-109.12v36.375h36.375z" />
      <path d="m291 800.06h36.188v36.375h-36.188z" />
      <path d="m254.63 800.06v-181.87h-36.375v254.63h36.375z" />
    </svg>
  );
}

/** "AI shimmer" (noun-8401748): the toolbar run affordance. */
export function IconRun(props: IconProps) {
  return (
    <svg {...nounBase(props)}>
      <path d="m941.63 714.71c-176.76-120.71-332.29-317.86-405.61-514.31-6.4688-17.391-22.453-27-34.781-27.469h-1.0781c-1.6875 0-3.1406 0.14062-4.5469 0.46875l-1.2188 0.375c-4.2188 1.2188-7.3125 3.9375-9.375 8.2969-74.156 158.72-231.32 273.79-410.02 300.1-7.3125 1.0781-11.766 5.2969-13.453 12.469-2.625 11.297 2.8594 28.219 18.234 38.766 176.76 120.71 332.29 317.86 405.61 514.31 6.4688 17.391 22.453 27 34.781 27.469 7.7812 0.375 13.219-2.7656 16.219-9 74.297-159 231.37-273.94 410.06-300.37 7.3125-1.0781 11.766-5.2969 13.453-12.469 2.625-11.109-2.7656-28.031-18.281-38.625z" />
      <path d="m562.45 1065 139.55-37.453 0.70312-0.14062c5.5312-0.70312 9.6094-3.8438 12.141-9.1406 43.078-92.297 114.14-169.69 201.14-223.55-152.9 33.047-285.52 133.97-353.53 270.28z" />
      <path d="m1120.2 666.84c-176.76-120.71-332.29-317.86-405.61-514.31-7.0781-18.844-24.938-28.922-37.922-27.703l-141 37.781c9.7031 7.4531 17.531 17.766 21.938 29.766 71.859 192.24 223.92 385.22 397.08 503.39 21.469 14.625 32.859 40.547 27.703 62.859-0.14062 0.46875-0.23438 0.84375-0.375 1.2188 45.141-20.156 93.234-34.453 143.06-41.766 7.3125-1.0781 11.766-5.2969 13.453-12.469 2.5312-11.297-2.8594-28.219-18.328-38.766z" />
    </svg>
  );
}

/** "page" (noun-page-7938088): document stripe. */
export function IconDoc(props: IconProps) {
  return <svg {...nounBase(props)}><path d="m303.28 174.66v-108.94l-108.94 108.94zm-133.36 34.547h150.66c9.5625 0 17.297-7.7344 17.297-17.297l-0.046875-150.61h609.32v1034.5h-777.24zm811.82-52.969h48.328v1002.5h-745.22v-48.328h696.89zm-594.05 283.78 170.81 98.625 170.81-98.625-170.76-98.625zm153.56 325.69v-197.26l-170.72-98.578v197.21zm26.953 44.203 203.16-117.28c5.7656-2.8125 9.75-8.7188 9.75-15.562v-237.05h-0.046875c0-6.75-3.6562-12.281-9.5625-15.422l-204.19-117.89-17.344-0.09375-203.9 117.7c-5.9531 2.7188-10.125 8.7188-10.125 15.703v237.05h0.046875c0 5.9531 3.0938 11.719 8.5781 14.906l204.24 117.89c6.2344 3.8906 13.406 4.125 19.406 0.046875zm7.5938-241.45v197.26l170.72-98.578v-197.21z" /></svg>;
}

/** "cubes" (noun-cubes-7983982): memory/artifact domain and index rail. */
export function IconMemory(props: IconProps) {
  return <svg {...nounBase({ domain: 'memory', ...props })}><path d="m78.844 695.21 226.08 130.55 226.13-130.55-226.08-130.6zm260.72-190.26v-261.05l225.89 130.45v261.05zm294.98 130.45 225.89-130.4v-261.1l-225.89 130.45zm191.53-451.22-226.08-130.55-226.08 130.55 226.08 130.5zm34.359 962.21v-261.05l-225.89-130.4v261.05zm69.141-261.14v261.14l225.89-130.45v-261.1zm-260.63-190.08 226.08-130.55 226.13 130.55-226.08 130.55zm-398.53 451.22-225.89-130.45v-261.1l225.89 130.4zm69.141-261.05 225.89-130.4v261.05l-225.89 130.4z" /></svg>;
}

export function IconRail(props: IconProps) {
  return <IconMemory domain="graph" {...props} />;
}

/** Stop/search/chevron are state controls, not taxonomy glyphs. */
export function IconStop(props: IconProps) {
  return <svg {...controlBase(props)}><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none" /></svg>;
}

export function IconSearch(props: IconProps) {
  return <svg {...controlBase(props)}><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>;
}

export function IconInspector(props: IconProps) {
  return <svg {...controlBase(props)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M9.5 3v10" /></svg>;
}

export function IconChevronDown(props: IconProps) {
  return <svg {...controlBase(props)}><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></svg>;
}

/** The tool window header's hide affordance (HANDOFF-CONSOLE-DIMENSIONALITY
 *  X3.2): the Int UI "hide" mark, a bar the panel collapses toward. A control
 *  primitive, so it strokes rather than fills. */
export function IconHide(props: IconProps) {
  return <svg {...controlBase(props)}><path d="M3.5 8h9" /></svg>;
}

export function IconAttach(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <path d="m6.25 8.75 3.6-3.6a2.1 2.1 0 0 1 3 3l-5.3 5.3a3.4 3.4 0 0 1-4.8-4.8l5.1-5.1" />
    </svg>
  );
}

export function IconCommand(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <path d="M5.25 5.25h5.5v5.5h-5.5z" />
      <path d="M5.25 5.25H4a2 2 0 1 1 2-2v1.25m4.75 1H12a2 2 0 1 0-2-2v1.25m.75 6.25V12a2 2 0 1 1-2-2h1.25m-4.75.75V12a2 2 0 1 0 2-2H6" />
    </svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <path d="m2.5 3 11 5-11 5 2-5-2-5Z" />
      <path d="M4.5 8h5" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7.25v4" />
      <path d="M8 4.75h.01" />
    </svg>
  );
}

/** Copy and its settled acknowledgement: the address affordance on cards and
 *  the inspector footer. Controls, not taxonomy, so register strokes. */
export function IconCopy(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <rect x="5.75" y="5.75" width="7.5" height="7.5" rx="1.5" />
      <path d="M10.25 3.75a1.5 1.5 0 0 0-1.5-1.5h-4.5a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return <svg {...controlBase(props)}><path d="m3.5 8.5 3 3 6-6.5" /></svg>;
}

export function IconAccount(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3.5 13c.6-2.1 2.1-3.2 4.5-3.2s3.9 1.1 4.5 3.2" />
    </svg>
  );
}

export type ObjectKind = 'doc' | 'code' | 'record' | 'thread' | 'settings';

export function KindDot({ kind }: { kind: ObjectKind }) {
  const color = {
    doc: 'var(--ij-agent)',
    code: 'var(--ij-graph)',
    record: 'var(--ij-memory)',
    thread: 'var(--ij-room)',
    settings: 'var(--ij-accent)',
  }[kind];
  return <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: color }} />;
}

/** Surface nav: workspace (split panes). */
export function IconWorkspace(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6.5 3v10" />
    </svg>
  );
}

/** Surface nav: cards (stacked faces). */
export function IconCards(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <rect x="3" y="4.5" width="9" height="8" rx="1.5" />
      <path d="M5 4.5V3.5A1 1 0 0 1 6 2.5h6a1 1 0 0 1 1 1v7" />
    </svg>
  );
}

/** Surface nav: model (kinds and relations). */
export function IconModel(props: IconProps) {
  return (
    <svg {...controlBase(props)}>
      <circle cx="4" cy="4" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="4" r="1.75" />
      <path d="M5.2 5.2 10.8 10.8M5.75 4h4.5" />
    </svg>
  );
}
