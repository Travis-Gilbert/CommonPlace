// SOURCING: next/link through @ui/navigation/LinkAdapter (TU3 router seam).

import React from 'react';
import { LinkAdapter } from '@ui/navigation/LinkAdapter/LinkAdapter';

import styles from './UndecoratedLink.module.scss';

type UndecoratedLinkProps = {
  to: string | number;
  children: React.ReactNode;
  replace?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  fullWidth?: boolean;
};

export const UndecoratedLink = ({
  children,
  to,
  replace = false,
  onClick,
  fullWidth = false,
}: UndecoratedLinkProps) => {
  return (
    <LinkAdapter
      to={to as string}
      replace={replace}
      onClick={onClick}
      className={styles.undecoratedLink}
      style={fullWidth ? { width: '100%' } : undefined}
    >
      {children}
    </LinkAdapter>
  );
};
