/* Tag hue assignment for the console register's cr-tag scale.

   A tag string maps deterministically (djb2, the repo's standard content hash)
   to one of the register's ten tag hues, so a given tag always wears the same
   color in every lens and across reloads without a stored palette. The class
   strings are spelled out in full rather than interpolated: Tailwind's source
   scanner emits a utility only when it sees the literal class, so a
   `bg-cr-tag-${hue}` template would generate nothing. */

export const CR_TAG_HUES = [
  'grey',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'blue',
  'sky',
  'teal',
  'green',
] as const;

export type CrTagHue = (typeof CR_TAG_HUES)[number];

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** The stable hue a tag wears, derived from its text. */
export function tagHue(tag: string): CrTagHue {
  return CR_TAG_HUES[djb2(tag) % CR_TAG_HUES.length];
}

/** Full utility-class trio per hue (soft fill, ink, line border), written out so
    the Tailwind scanner generates every cr-tag utility used here. */
export const CR_TAG_CHIP: Record<CrTagHue, string> = {
  grey: 'bg-cr-tag-grey-soft text-cr-tag-grey border-cr-tag-grey-line',
  yellow: 'bg-cr-tag-yellow-soft text-cr-tag-yellow border-cr-tag-yellow-line',
  orange: 'bg-cr-tag-orange-soft text-cr-tag-orange border-cr-tag-orange-line',
  red: 'bg-cr-tag-red-soft text-cr-tag-red border-cr-tag-red-line',
  pink: 'bg-cr-tag-pink-soft text-cr-tag-pink border-cr-tag-pink-line',
  purple: 'bg-cr-tag-purple-soft text-cr-tag-purple border-cr-tag-purple-line',
  blue: 'bg-cr-tag-blue-soft text-cr-tag-blue border-cr-tag-blue-line',
  sky: 'bg-cr-tag-sky-soft text-cr-tag-sky border-cr-tag-sky-line',
  teal: 'bg-cr-tag-teal-soft text-cr-tag-teal border-cr-tag-teal-line',
  green: 'bg-cr-tag-green-soft text-cr-tag-green border-cr-tag-green-line',
};

/** The chip classes for a given tag, resolved through its hue. */
export function tagChipClass(tag: string): string {
  return CR_TAG_CHIP[tagHue(tag)];
}
