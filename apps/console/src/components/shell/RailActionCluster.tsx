'use client';

// SOURCING: twenty-ui/input RoundedIconButton for the primary affordance and
// LightIconButton for the secondaries, twenty-ui/data-display Pill for the meta
// line, per the "Inspector rail action cluster" and "Inspector rail meta footer"
// ledger rows. Sizing and press behaviour are the fork's and are not restated.
//
// The reference's cluster is one round primary, smaller secondaries beside it,
// and a line of hint text. That shape is what this reproduces. What it does not
// reproduce is the reference's particular buttons: theirs is push-to-talk, and
// this product has no voice input, so a microphone here would be a picture of a
// feature. Every control below runs something that exists, and a secondary with
// no handler does not render rather than rendering dead.
//
// The meta line is the same rule. The reference shows a context window and a
// spend figure; this app has no reading for either at the rail, so the line
// carries what is actually known, which is whether a run is in flight. A footer
// that invented a token count would be worse than a shorter footer.

import { RoundedIconButton, LightIconButton } from 'twenty-ui/input';
import { Pill } from 'twenty-ui/data-display';
import { IconModel, IconHide, IconCommand } from '@/components/shell/icons';
import { forkIcon } from '@/components/shell/fork-icon';
import { useThreadStore } from '@/lib/thread-store';
import { cn } from '@/lib/cn';

// Module scope: a component identity minted during render remounts the icon.
const CanvasIcon = forkIcon(IconModel);
const CollapseIcon = forkIcon(IconHide);
const PaletteIcon = forkIcon(IconCommand);

export interface RailActionClusterProps {
  /** Primary: opens the canvas surface that owns the rail's model. */
  readonly onOpenCanvas: () => void;
  /** Secondary: collapses the rail. */
  readonly onCollapse: () => void;
  /** Secondary: opens search everywhere. Omitted when the host has no palette. */
  readonly onOpenPalette?: () => void;
  readonly className?: string;
}

export function RailActionCluster({
  onOpenCanvas,
  onCollapse,
  onOpenPalette,
  className,
}: RailActionClusterProps) {
  const isRunning = useThreadStore((state) => state.isRunning);

  return (
    <div
      data-rail-action-cluster
      className={cn('flex shrink-0 flex-col gap-2 px-3 py-3', className)}
    >
      <div className="flex items-center gap-2">
        <RoundedIconButton
          Icon={CanvasIcon}
          size="medium"
          aria-label="Open the model canvas"
          onClick={onOpenCanvas}
        />
        <LightIconButton
          Icon={CollapseIcon}
          title="Collapse the rail"
          accent="tertiary"
          onClick={onCollapse}
        />
        {onOpenPalette ? (
          <LightIconButton
            Icon={PaletteIcon}
            title="Search everywhere"
            accent="tertiary"
            onClick={onOpenPalette}
          />
        ) : null}
        <span className="ml-1 truncate text-ij-island-meta text-ij-ink-info">
          Open the canvas
        </span>
      </div>

      <div data-rail-meta className="flex items-center gap-2">
        <Pill label={isRunning ? 'Run in flight' : 'Idle'} />
      </div>
    </div>
  );
}
