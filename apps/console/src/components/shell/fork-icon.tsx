'use client';

// SOURCING: none. The seam between the Icons ledger row and the twenty-ui fork.
//
// Both sides are already settled and they disagree by one type. Every product
// glyph is a Noun mark from `components/shell/icons.tsx`, whose props are
// SVGProps plus `size?: number`. The fork's components take an IconComponent,
// whose `size` is `number | string`, because upstream passes theme sizes that
// are sometimes CSS lengths. A component that accepts only `number` cannot
// stand where one accepting `number | string` is called, so this is a real
// incompatibility rather than a cast someone forgot.
//
// Bridged rather than resolved on either side: widening the Noun marks would
// let a CSS length reach an SVG width that expects a number, and importing the
// fork's own icons would put glyphs on the surface that the icon gate exists to
// keep off it. Call this at module scope, never in render: a component identity
// created during render is a different type on every pass, which remounts the
// icon and throws away its paint.

import type { ComponentType, SVGProps } from 'react';
// The fork's own contract, imported rather than restated. A hand-copied version
// of this type drifted immediately: it missed that `stroke` is `number | string`
// and that `aria-hidden` is part of the shape, and the compiler was the only
// thing that noticed.
import type { IconComponent, IconComponentProps } from 'twenty-ui/icon';

type ConsoleIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export function forkIcon(Icon: ConsoleIcon): IconComponent {
  return function ForkIcon({ size, stroke: _stroke, color, style, ...rest }: IconComponentProps) {
    // A CSS length has no meaning to the Noun marks' numeric size, so it is
    // dropped to their default rather than coerced into a wrong number.
    const numeric = typeof size === 'number' ? size : Number.parseFloat(String(size ?? ''));
    return (
      <Icon
        {...rest}
        size={Number.isFinite(numeric) ? numeric : undefined}
        style={color ? { color, ...style } : style}
      />
    );
  };
}
