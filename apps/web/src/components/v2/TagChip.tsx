import { tagChipClass } from '@/lib/v2/tag-color';

/* A tag rendered as a filled register chip: a hue-tinted fill, hue ink, and a
   hairline hue border, the color chosen deterministically from the tag text
   (see tag-color.ts). Shared across every lens so a tag reads the same wherever
   it appears. Register-native: cr-tag utilities for color, px-chip/py-chip for
   the register's chip padding, font-cr-mono at the caption size. */
export function TagChip({ tag, className }: { tag: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-cr-sm border px-chip py-chip font-cr-mono text-cr-caption leading-none ${tagChipClass(
        tag,
      )}${className ? ` ${className}` : ''}`}
    >
      {tag}
    </span>
  );
}
