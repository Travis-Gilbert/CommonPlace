# HANDOFF-CONSOLE-CHAT-SURFACE

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`. Register: execution handoff; named
choices are requirements. Decided with Travis 2026-07-20.

Companions: HANDOFF-CONSOLE-BLOCK-SYSTEM (B1, B3 routes, B9 composer block are dependencies),
HANDOFF-CONSOLE-ISLAND-SHELL (the island mount of the composer inherits it), the console pivot
decision log (Composer terminology, centerpiece placement, Cmd/Ctrl-L, floating summon buttons
and docked-right chat banned by name; speaker registers).

Writing rules: no em dashes anywhere. No invented numbers. Status reports lead with what is not
done.

## What this is

The chat surface designed on purpose. The composer's inspiration is the claude.ai composer, the
proportions and texture are Theorem: JetBrains dimensions, register tokens, material paint. The
thread borrows Zed's multibuffer: a conversation is excerpts in one scroll, not bubbles.

## Verify first

- `apps/console/src/components/composer/Composer.tsx` (17941 bytes today) and
  `ComposerSheenCanvas.tsx` (decide what survives the rebuild; the sheen may become the
  material-layer lit edge rather than its own canvas)
- `apps/console/src/views/ThreadView.tsx` (the thread this evolves)
- `apps/console/src/views/cm-register-theme.ts` and the installed CodeMirror packages (code
  excerpts)
- `@assistant-ui/react` 0.12.28 and `@assistant-ui/react-markdown` in
  `apps/console/package.json` (already installed; the rebuild rides their primitives)
- `apps/console/src/components/mark/` (the presence mark; its register rules apply to send and
  streaming states)
- `NEXT_PUBLIC_CONSOLE_CHAT_URL` in `railway.console.toml` (the composer's declared transport
  exception per B choice 3)

Search before asserting absence. Listings truncate.

## Named choices

1. **Placement, unchanged.** `/chat` owns the surface (B3). Thread column max-width 760px,
   centered. The composer is the centerpiece: lower third, wide as the thread column,
   Cmd/Ctrl-L focuses. The ratified bans stand.

2. **Composer rebuild on assistant-ui primitives.** `Composer.tsx` is rebuilt over
   `@assistant-ui/react` composer and thread primitives rather than hand-rolled input state.
   Anatomy: one container, radius 12 (island family), editor-class base (lighter, per the
   variation amendment) with the lit top edge supplied by the material layer; input area
   minimum height 88px, grows with content to a 40 percent viewport ceiling then scrolls;
   padding 14px vertical, 16px horizontal; instrument row 40px containing attach, context
   chip, model selector, and send.

3. **Composer typography and registers.** Input text is Manrope 15/500, line height 1.5 (the
   human is the author here; this is the largest Manrope surface in the console). Placeholder
   is IBM Plex Sans, muted, never an error string. Model selector renders the model name in
   JetBrains Mono 12 (machine value). Send is a 32px accent-interactive control; the presence
   mark rules apply: teal base while the agent streams, teal contraction on commit, oxblood
   edge only on user interruption.

4. **The unavailable state renders once.** When `NEXT_PUBLIC_CONSOLE_CHAT_URL` is absent or the
   endpoint refuses, the composer disables with one notice in its status slot. Never in the
   placeholder, never as a body paragraph, never duplicated above the input. The current
   triple rendering is the named defect this closes.

5. **Thread as multibuffer.** Turns, tool receipts, and referenced objects render as excerpts
   in one scroll: each excerpt carries a sticky 24px header (JetBrains Mono 11: speaker or
   receipt kind, timestamp, collapse control) and a body in the speaker's face per the
   registers (human Manrope, agent IBM Plex Sans). Tool calls and receipts are collapsible
   excerpts, collapsed by default to their header plus one summary line. A referenced object
   (`theorem://` address or object mention) can be pulled inline as an excerpt through the
   object seam, read-only, with an open action. Code excerpts render in CodeMirror with
   `cm-register-theme`. At widths above 1200px a jump strip of excerpt headers renders at the
   right edge of the thread column.

6. **Suggestion chips.** The live tenant context chips stay, restyled to the token seam:
   height 32px, IBM Plex Sans 13, island base, radius 8, no free-floating pill styling.

7. **Composer is the B9 block.** This handoff builds the surface mount. The island mini
   composer arrives by inheritance: same descriptor, `IslandShell` chrome, compact density,
   scoped context. No separate mini-composer component exists.

8. **Paper stage.** Composer states (idle, focused, streaming, disabled) and the excerpt
   anatomy are designed in Paper against a live thread (Paper MCP plus harness MCP,
   heads-local), extracted with `get_jsx` and `get_computed_styles`. Register stays canonical.

## Deliverables

**CH1.** Composer rebuilt per choices 2 through 4 on assistant-ui primitives; the sheen
decision recorded in the file header (kept as canvas or replaced by material edge, with the
reason).

**CH2.** `ThreadView.tsx` evolved to the multibuffer model: excerpt component, sticky headers,
collapse, object pull-in through the seam, jump strip.

**CH3.** Suggestion chips on the token seam.

**CH4.** Composer and excerpt tokens in the registers and bridge; manifest regenerated.

**CH5.** State coverage: idle, focused, streaming, interrupted, disabled, endpoint-refused,
each designed, each rendering once.

## Acceptance

1. With the chat URL unset, exactly one unavailable notice appears on the entire surface.
2. Cmd/Ctrl-L focuses the composer from any scroll position.
3. A thread containing a tool receipt and a referenced object shows both as collapsible
   excerpts; expanding the object excerpt loads through the object seam.
4. Grayscale capture distinguishes human and agent excerpts by face and weight alone.
5. Send, streaming, and interruption follow the presence mark rules; no other accent appears
   in the instrument row.
6. The island-mounted composer renders through `IslandShell` with zero composer-specific
   container styling.
7. `pnpm gates` passes.

## Out of scope

Sidebar (own handoff), Research and Code surface variants of the chat screen (they inherit
this anatomy in their own passes), assistant-ui version upgrades, chat backend changes.
