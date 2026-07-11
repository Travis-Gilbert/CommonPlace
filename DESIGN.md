# CommonPlace Growth Design

## Theme

Use the existing CommonPlace porcelain console register. The page is a monitoring surface with an asymmetric hierarchy. The signed card is the primary object. Readiness, skills, lineage, and publication details support it without competing for attention.

## Design System

- Source tokens: `apps/web/src/styles/console-register.css`
- Tailwind bridge: `apps/web/src/styles/global.css`
- Shell: `apps/web/src/components/v2/V2Shell.tsx`
- Surface styles: a route-local CSS module that consumes `--cr-*` tokens only
- No raw color values outside a token definition
- No one-off radius, shadow, spacing, duration, or breakpoint values

## Typography

- Interface: `--cr-font-ui`
- Measurements and fingerprints: `--cr-font-mono`
- Card title and flavor text may use `--cr-font-prose`
- Body copy uses `--cr-text-body` with `--cr-leading-body`
- Metadata uses `--cr-text-small` or `--cr-text-caption`
- Long explanatory copy is limited to `--cr-measure`

## Color

- Ground: `--cr-ground`
- Surface: `--cr-surface`
- Raised surface: `--cr-top`
- Primary ink: `--cr-ink`
- Secondary ink: `--cr-ink-2`
- Muted ink: `--cr-ink-3`
- Borders: `--cr-hairline`
- Primary signal: `--cr-signal`
- Links and informational emphasis: `--cr-link`
- Card art may derive deterministic color parameters from disclosed stats, but surrounding controls use register tokens.

## Layout

- Dedicated route: `/v2/growth`
- Dedicated `Growth` entry under the Harness rail
- Compact page header with freshness and availability state
- APG tablist for Card, Timeline, Mathematics, Stamp, and Marketplace
- Card view uses an asymmetric grid: signed card as the dominant object, readiness and proven skills as supporting regions
- At constrained widths, regions stack in reading order and retain a single vertical scroll axis
- Desktop acceptance viewports: 1280 and 1440 pixels wide

## Components

### Growth tabs

- Native button triggers with `role="tab"`
- Arrow keys move focus, Home and End jump to bounds, Enter or Space activates
- `aria-selected`, `aria-controls`, and labelled tab panels remain synchronized
- Focus uses the existing register focus treatment

### Signed card

- SVG face generated deterministically from displayed statistics
- Face and provenance back are both reachable by keyboard
- Flip interaction never hides the current state from assistive technology
- Public fingerprint only; private keys never enter the web contract

### Mathematics

- Cosmos or Canvas is enhancement, not the information source
- A semantic list or table exposes every displayed context, mass, uncertainty, and readiness state
- A static SVG or CSS fallback is visible if the renderer cannot start
- Context loss, unmount cleanup, bounded device pixel ratio, and offscreen pause are required

### Timeline

- Commit list and selected detail use semantic list and article structure
- Level and evolution beats use text and shape, not color alone
- Historical XP and level values come from the same snapshot contract as the Card

### Stamp

- Explicit typed edges only
- Empty graphs show a named empty mark
- Callouts are available in DOM text as well as the graphic

### Marketplace

- Read-only inspection and comparison
- Opt-in publication fields are visibly distinguished from unavailable fields
- No transaction controls

## States

Every Growth view implements loading, empty, unavailable, error, stale, and populated states. Production routes do not accept fixture flags. Unavailable live data names the missing GraphQL capability and offers a retry when meaningful.

## Motion

- Use `--cr-motion`, `--cr-motion-doc`, and `--cr-ease`
- Motion communicates feedback, orientation, or relationship only
- No ambient motion in the monitoring shell
- `prefers-reduced-motion` removes spatial movement, shimmer, and graph interpolation

## Accessibility

- WCAG AA contrast
- Visible focus on every control
- Minimum target size follows the existing control tokens and reaches at least 24 by 24 pixels
- Page landmarks and heading hierarchy remain semantic
- Status changes use appropriate live regions
- Canvas content has an equivalent DOM representation

## Validation

- Static CSS and token lint for color, focus, motion, spacing, typography, breakpoints, and raw values
- APG behavioral checks for tabs
- Rendered axe checks for the populated and unavailable states
- Keyboard walkthrough for tabs, card face and back, timeline selection, and marketplace comparison
- Browser proof at 1280 and 1440 pixels plus a constrained-width reflow check
