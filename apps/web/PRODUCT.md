# Product

## Register

product

## Users

Knowledge workers operating CommonPlace/Theorem: people doing AI-assisted research, coding, and coordination against a live object graph (Theseus retrieval, code intelligence, docs, boards). They currently context-switch between separate chat, code, canvas, and document surfaces; the job to be done on `/v2/work` is running one continuous session (ask, inspect tool output, edit code, sketch a board, write a doc) without losing place or state on reload.

## Product Purpose

Unify thread, code, board, and doc into one work surface backed by real object-graph data and a real streaming research pipeline (askTheseusAsyncStream), not a demo shell. Success looks like: a session survives a full page reload, pipeline stages read as inspectable tool calls rather than a black-box spinner, and switching stage (chat/code/doc/board) never fabricates data or dead-ends in an inert UI.

## Brand Personality

Restrained, structural, editorial, confident, unadorned. Established by the existing porcelain theme (warm off-white ground, one reserved accent color meaning "pending decision or tension," teal as the calm baseline for everything else) and by this repo's own standing bans on gradient text, glassmorphism-as-default, hero-metric templates, side-stripe borders, identical card grids, and modal-as-first-thought. Nothing in the surface should read as generic SaaS chrome.

## Anti-references

Generic AI-chat SaaS dashboards (gradient hero metrics, glass cards, badge-heavy sidebars, chat bubbles with drop shadows). The rail's own law already states it: no counts, no badges, nothing red except the one reserved accent for pending decisions or tension.

## Design Principles

- Real data or an honest empty state, never a fabricated one. If a stage has no backing data yet, it says so plainly instead of faking activity.
- One accent, one meaning. Red/accent is reserved for pending decisions and tension; everything else recedes into the warm-neutral ground.
- Structure over decoration. Hierarchy comes from spacing, type scale, and weight, not from cards, gradients, or glass.
- Motion explains state changes (stage transitions, presence, streaming), it does not perform for its own sake, and it yields to `prefers-reduced-motion`.

## Accessibility & Inclusion

WCAG 2.1 AA as the floor (the porcelain palette is already tuned for 4.5:1 on faint text against the ground). `prefers-reduced-motion` must be respected everywhere new motion is added, matching the existing `useReducedMotion` pattern already in use on this surface.
