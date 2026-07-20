'use client';

// SOURCING: Int UI register metrics (the X3 panel and header strip, reproduced
// from IntuiShell's ToolWindowHeader so the surface bounds itself the way every
// other bounded region in this app does) plus the Twenty structural group for
// density; `radix-ui` Popover for the overflow menu (an existing ledger row).
// The canvas micro-visuals are hand-rolled, per 32's named choice 7, which
// scopes canvas to exactly three points on this surface.

/**
 * The board vocabulary (32-HANDOFF-PROACTIVITY-MATERIAL-AND-DENSITY).
 *
 * Five causes were named; four of them are cured here, and none of them by
 * canvas:
 *
 * 1. Floating in white -> `Panel`. A section is a bounded plane with a header
 *    strip and seams, not a mono label drifting over a void. This is X3's rule,
 *    applied to a surface that never received it.
 * 2. Density inversion -> the Twenty metrics throughout: the 4px grid, the 8px
 *    cell rhythm, and the restored ramp (title 15, body 13, machinery 12).
 * 3. Skeleton, not material -> `KindTile`, `StatRun`, `SpendMeter`,
 *    `FiredSparkline`. A repo card reads as an object because it has anchors;
 *    text-only stat lines are a wireframe of one.
 * 4. Color as tinted words -> `StateBadge` and the tile. Semantic color sits in
 *    SHAPES: a tile, a badge, a meter, a rail. Nothing below 13px carries a
 *    semantic hue, because small colored text on white vibrates, reads cheap,
 *    and collides with link blue.
 *
 * The fifth (administrative repetition) is cured by `OverflowMenu` and
 * `SourceRow`, which take six identical buttons down to one per card face and a
 * five-row switch panel.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Popover } from 'radix-ui';
import { cn } from '@/lib/utils';
import type { PgNodeKind } from '@/lib/proactivity/model';
import { KIND_META } from './kinds';

/* ------------------------------------------------------------------ panels */

/**
 * A bounded section. The header strip is the Int UI tool-window band (24px, the
 * register's 13px title, a bottom seam) so a panel here is recognisably the
 * same object as a tool window: one app, one way of bounding a region.
 *
 * `action` is the header's right slot. A panel that owns an affordance carries
 * it in the strip rather than floating it above the content, which is how the
 * compile input stops being a billboard.
 */
export function Panel({
  title,
  action,
  banner,
  children,
  className,
  ...props
}: {
  readonly title: string;
  readonly action?: ReactNode;
  /** A bounded band inside the panel, directly under the header strip: the
   *  panel's own header REGION. The compile affordance sits here, which is what
   *  makes it a panel's tool rather than a page-wide billboard. */
  readonly banner?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<React.ComponentProps<'section'>, 'title' | 'children'>) {
  return (
    <section
      data-board-panel
      className={cn('flex min-w-0 flex-col overflow-hidden rounded-ij-arc border border-ij-seam bg-ij-editor', className)}
      {...props}
    >
      <header
        data-board-panel-header
        className="flex h-ij-toolwindow-header shrink-0 items-center gap-2 border-b border-ij-seam bg-ij-chrome px-2 text-rec-body text-ij-ink"
        style={{ fontWeight: 'var(--rec-weight-cap)' }}
      >
        <h3 className="min-w-0 shrink-0 truncate font-ij-ui">{title}</h3>
        {action ? <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{action}</div> : null}
      </header>
      {banner ? (
        <div data-board-panel-banner className="shrink-0 border-b border-ij-divider bg-ij-chrome px-2 py-2">
          {banner}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------- kind tiles */

/** The tint pair for each kind's tile: a tinted plate carrying the kind's own
 *  accent. Capacities' pattern on our domain tokens, so the tile is
 *  recognisable at a glance and the pair is contrast-gated like any other. */
const TILE: Record<PgNodeKind, { plate: string; ink: string; mark: string }> = {
  stake: { plate: 'bg-ij-graph-tint', ink: 'text-ij-graph', mark: 'S' },
  source: { plate: 'bg-ij-memory-tint', ink: 'text-ij-memory', mark: 'F' },
  watch: { plate: 'bg-ij-agent-tint', ink: 'text-ij-agent', mark: 'W' },
  judgment: { plate: 'bg-ij-room-tint', ink: 'text-ij-room', mark: 'J' },
  response: { plate: 'bg-ij-gold-tint', ink: 'text-ij-gold', mark: 'R' },
  assumption: { plate: 'bg-ij-chrome', ink: 'text-ij-ink-info', mark: 'A' },
  execution: { plate: 'bg-ij-chrome', ink: 'text-ij-ink-info', mark: 'X' },
};

/**
 * The card's leading anchor: a tinted plate with the kind's letterform, and a
 * 3px inset rail down its leading edge in the AUTHOR's lane color.
 *
 * The rail is where the speaker register belongs. Authorship shipped as the
 * word "agent" in teal at 11px, which is the failure mode named choice 5
 * corrects: color in small type vibrates and cheapens, color in a shape reads
 * instantly. It is also why the letterform is here rather than a glyph, since
 * decision 12 holds this surface to no new product glyphs: the mark is a
 * letter, not an icon.
 *
 * Authorship survives grayscale because it is carried twice, by the rail's
 * position AND by the title's face; that redundancy is the Q3 assertion.
 */
export function KindTile({
  kind,
  laneInk,
  size = 'md',
}: {
  readonly kind: PgNodeKind;
  /** The author's lane color, as a register var. */
  readonly laneInk?: string;
  readonly size?: 'sm' | 'md';
}) {
  const tile = TILE[kind];
  return (
    <span
      data-kind-tile={kind}
      aria-hidden="true"
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-ij-arc font-ij-mono font-semibold',
        tile.plate,
        tile.ink,
        size === 'sm' ? 'size-5 text-rec-machine' : 'size-7 text-rec-body',
      )}
    >
      {laneInk ? (
        <span
          data-author-rail
          className="absolute inset-y-0 left-0 w-rec-grid"
          style={{ backgroundColor: laneInk }}
        />
      ) : null}
      {tile.mark}
    </span>
  );
}

/* ------------------------------------------------------------ state badges */

export type BadgeTone = 'gold' | 'amber' | 'neutral';

/**
 * A state phrase, as a badge. Every phrase that used to render as colored small
 * text lands here (named choice 4): over budget on amber, learned autonomy on
 * gold, a pending ask on neutral. A badge can carry hue because it is a shape
 * with its own ground; a 12px sentence on the page cannot.
 */
export function StateBadge({ tone, children }: { readonly tone: BadgeTone; readonly children: ReactNode }) {
  return (
    <span
      data-state-badge={tone}
      data-type-role="machine"
      className={cn(
        'inline-flex shrink-0 items-center rounded-ij-arc border px-1.5 py-0.5 font-ij-mono text-rec-machine leading-none',
        tone === 'gold' && 'border-ij-gold bg-ij-gold-tint text-ij-gold',
        tone === 'amber' && 'border-ij-warn bg-ij-warn-bg text-ij-warn',
        tone === 'neutral' && 'border-ij-control-border bg-ij-chrome text-ij-ink-info',
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------- canvas visuals */

/**
 * The computed register, for a canvas to read its paint out of. The micro
 * visuals paint nothing rather than fall back to a literal, exactly as
 * GroundCanvas does: a canvas is not an exemption from the register.
 *
 * Every token name is spelled at its own `getPropertyValue` call rather than
 * passed through a helper, because the token gate reads call sites and a helper
 * would hide the reference from it. The gate is right to insist: a token
 * reference that cannot be grepped at the point of use is one nobody reviews.
 */
function registerStyle(): CSSStyleDeclaration {
  return getComputedStyle(document.documentElement);
}

/**
 * The spend meter (named choice 7, point two). Budget was a sentence, "spend 13
 * of 10", which makes you do arithmetic to learn the one thing that matters:
 * whether there is room left. A meter answers that before you read the numbers,
 * and over-budget overruns its track visibly rather than telling you it did.
 *
 * Static: one paint per data change, no frame loop, so it is outside the
 * paint-surface inventory by the same argument as the grain.
 */
export function SpendMeter({ spent, cap }: { readonly spent: number; readonly cap: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const over = cap !== null && spent > cap;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const w = Math.min(canvas.clientWidth, 8192);
    const h = Math.min(canvas.clientHeight, 8192);
    if (w < 1 || h < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, w, h);

    const style = registerStyle();
    const track = style.getPropertyValue('--ij-seam-raised').trim();
    const warn = style.getPropertyValue('--ij-warn').trim();
    const ok = style.getPropertyValue('--ij-ok').trim();
    const fill = over ? warn : ok;
    if (track.length === 0 || fill.length === 0) return;

    const radius = h / 2;
    const rounded = (x: number, width: number, color: string) => {
      if (width <= 0) return;
      context.fillStyle = color;
      context.beginPath();
      context.roundRect(x, 0, Math.max(width, h), h, radius);
      context.fill();
    };

    rounded(0, w, track);
    // An uncapped budget has nothing to be a fraction of, so the meter shows a
    // full quiet track rather than implying a limit that does not exist.
    const ratio = cap === null || cap === 0 ? 1 : Math.min(spent / cap, 1);
    rounded(0, w * ratio, fill);

    if (over) {
      // The overrun: a hard tick past the end of the track, so "over" is a
      // shape and not an adjective.
      const marker = style.getPropertyValue('--ij-error').trim();
      if (marker.length > 0) {
        context.fillStyle = marker;
        context.fillRect(w - 2, 0, 2, h);
      }
    }
  }, [spent, cap, over]);

  return (
    <canvas
      ref={canvasRef}
      data-spend-meter
      data-over-budget={over || undefined}
      aria-hidden="true"
      className="h-1.5 w-10 shrink-0"
    />
  );
}

/**
 * The fired sparkline (named choice 7, point two). A count says how often; a
 * sparkline says WHEN, which is what tells you whether a standing program is
 * still doing anything. Drawn from the projected firing history, so it is real
 * data and not decoration; a program that has never fired draws nothing.
 *
 * Static, like the meter.
 */
export function FiredSparkline({ firedOn }: { readonly firedOn: readonly string[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const key = firedOn.join(',');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const w = Math.min(canvas.clientWidth, 8192);
    const h = Math.min(canvas.clientHeight, 8192);
    if (w < 1 || h < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, w, h);

    const stamps = key.length > 0 ? key.split(',') : [];
    if (stamps.length === 0) return;
    const ink = registerStyle().getPropertyValue('--cp-agent').trim();
    if (ink.length === 0) return;

    // Each firing is a tick, placed by its position in the history and given a
    // height by its recency: the newest stands tallest, so a program that has
    // gone quiet slopes down and reads as quiet at a glance.
    context.fillStyle = ink;
    const slots = Math.max(stamps.length, 4);
    const step = w / slots;
    stamps.forEach((_, index) => {
      const recency = (index + 1) / stamps.length;
      const barHeight = Math.max(2, h * (0.35 + 0.65 * recency));
      context.globalAlpha = 0.45 + 0.55 * recency;
      context.fillRect(index * step, h - barHeight, Math.max(1.5, step - 1.5), barHeight);
    });
    context.globalAlpha = 1;
  }, [key]);

  return <canvas ref={canvasRef} data-fired-sparkline aria-hidden="true" className="h-3 w-8 shrink-0" />;
}

/* -------------------------------------------------------------- stat marks */

/** A clock, as a register stroke. The icon ledger reserves Noun Project marks
 *  for product and domain glyphs and leaves small control primitives to
 *  strokes; a clock beside a timestamp is a primitive, so this adds no glyph
 *  and keeps decision 12 intact. */
export function ClockMark() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0 opacity-70">
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M6 3.5V6l1.75 1.75" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// The stat ROW is the adopted card's own `repo-meta` slot; only the marks that
// go in it live here. One slot, one implementation.

export function Stat({ children, title }: { readonly children: ReactNode; readonly title?: string }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" title={title}>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------- overflow menu */

/**
 * The card's secondary actions. Named choice 4 caps a card face at one button;
 * six identical Disable buttons down a page is what "stiff" means at the layout
 * level, and the cure is not a smaller button but a menu.
 */
export function OverflowMenu({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        data-overflow-trigger
        aria-label={label}
        title={label}
        className="flex size-6 shrink-0 items-center justify-center rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
        style={{ transition: 'var(--rec-clickable-transition)' }}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
          <circle cx="6" cy="2" r="1" fill="currentColor" />
          <circle cx="6" cy="6" r="1" fill="currentColor" />
          <circle cx="6" cy="10" r="1" fill="currentColor" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={4}
          data-overflow-menu
          className="z-50 flex min-w-40 flex-col gap-0.5 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-1 text-rec-body text-ij-ink shadow-xl"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function OverflowItem({ onSelect, children }: { readonly onSelect: () => void; readonly children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-ij-control items-center rounded-ij-arc px-2 text-left text-rec-body text-ij-ink hover:bg-ij-hover-surface"
      style={{ transition: 'var(--rec-clickable-transition)' }}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ switch */

/**
 * The sources panel's control. A switch states a binary standing condition
 * ("this source is on") in the shape of that condition; a button labelled
 * "Disable" states an action and forces you to infer the state from the verb,
 * which is why five of them in a row read as a settings form.
 */
export function Switch({
  checked,
  label,
  onToggle,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-switch
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border',
        checked ? 'border-ij-ok bg-ij-ok-bg' : 'border-ij-control-border bg-ij-chrome',
      )}
      style={{ transition: 'var(--rec-clickable-transition)' }}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute size-2.5 rounded-full',
          checked ? 'right-1 bg-ij-ok' : 'left-1 bg-ij-ink-disabled',
        )}
      />
    </button>
  );
}

/** One row of the sources panel: name, live state, switch. 28px rhythm. */
export function SourceRow({
  id,
  name,
  state,
  live,
  onToggle,
}: {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly live: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div
      data-node={id}
      data-source-row
      className="flex h-rec-row items-center gap-2 border-b border-ij-divider px-2 last:border-b-0 hover:bg-ij-hover-surface"
      style={{ transition: 'var(--rec-clickable-transition)' }}
    >
      <span
        data-source-state={live ? 'live' : 'off'}
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full', live ? 'bg-ij-ok' : 'bg-ij-ink-disabled')}
      />
      <span
        className="min-w-0 flex-1 truncate font-cp-agent text-rec-body text-ij-ink"
        data-type-role="body"
        data-type-speaker="agent"
      >
        {name}
      </span>
      <span className="font-ij-mono text-rec-machine text-ij-ink-info" data-type-role="machine">
        {state}
      </span>
      <Switch checked={live} label={`${name} source`} onToggle={onToggle} />
    </div>
  );
}

export { KIND_META };
