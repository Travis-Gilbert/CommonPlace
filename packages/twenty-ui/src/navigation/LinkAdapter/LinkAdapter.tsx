'use client';

// SOURCING: next/link (Next.js App Router), adopted directly as the fork's only
// navigation primitive. Replaces react-router-dom, which upstream depended on
// in ten component files plus two testing decorators.
//
// One adapter, not a wrapper per component. Upstream's components all speak the
// same dialect: a `to` prop, and a `to ? Link : 'button'` polymorphism where the
// element type flips when a destination is present. LinkAdapter keeps that
// dialect and translates it to next/link once, so the ten call sites change by
// one identifier each and the router leaves the dependency graph entirely.

import NextLink from 'next/link';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

type AnchorProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'>;

export type LinkAdapterProps = AnchorProps & {
  /** Upstream's destination prop. Mapped to next/link's `href`. */
  to?: string;
  /** Replace the history entry instead of pushing one. */
  replace?: boolean;
  /** Opt out of viewport prefetching for links that are expensive to warm. */
  prefetch?: boolean;
  /**
   * Accepted and dropped. The polymorphic call sites pass `disabled` because
   * the same JSX renders a native button when there is no destination; an
   * anchor has no disabled attribute, and letting it through would emit an
   * invalid DOM prop warning on every link.
   */
  disabled?: boolean;
};

export const LinkAdapter = forwardRef<HTMLAnchorElement, LinkAdapterProps>(
  ({ to, replace, prefetch, disabled: _disabled, children, ...rest }, ref) => {
    if (to === undefined) {
      // Same shape as an inert anchor, which is what react-router's Link did
      // with an empty `to`. Keeps the polymorphic branches total.
      // oxlint-disable-next-line react/jsx-props-no-spreading
      return (
        <a ref={ref} {...rest}>
          {children}
        </a>
      );
    }

    return (
      <NextLink
        ref={ref}
        href={to}
        replace={replace}
        prefetch={prefetch}
        // oxlint-disable-next-line react/jsx-props-no-spreading
        {...rest}
      >
        {children}
      </NextLink>
    );
  },
);

LinkAdapter.displayName = 'LinkAdapter';
