/* Minimal inline SVG icons — no icon dependency, stroke follows currentColor.
   UI affordances only; object/emoji data still renders as its own glyph. */
import type { SVGProps } from "react";

const S = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...p,
});

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconFilter = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M3 5h18M6 12h12M10 19h4" /></svg>
);
export const IconSort = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" /></svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
);
export const IconGallery = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
);
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 9h18M3 14h18M9 4v16" /></svg>
);
export const IconList = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
);
export const IconBoard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...S(p)}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="14" rx="1.5" /></svg>
);
