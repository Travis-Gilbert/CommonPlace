# Paper Trail Build Specs

Four implementation documents for Claude Code, each runnable independently.

## Build Order

| Doc | Scope | Dependencies |
|-----|-------|-------------|
| **Build 1** | Data import, D3 graph explorer (Next.js), homepage section, rename | None |
| **Build 2** | Sourcebox intake app, Python connection engine | Build 1 |
| **Build 3** | Public Paper Trail pages on research.travisgilbert.me | Build 1 |
| **Build 4** | Per-essay OG images, advanced D3 visualizations | Builds 1 + 3 |

## Files

Download the full specs from the Claude conversation or find them committed to this directory.

Each document is optimized for Claude Code with:
- Exact file paths and create/modify instructions
- Brand tokens inline (no external lookups needed)
- Verification checklists
- No em dashes in any generated content

## Connection Engine Note

Two connection engines exist in this project:
- **TypeScript** (`src/lib/connectionEngine.ts`): Build-time engine resolving frontmatter relationships (essay `related`, field note `connectedTo`, shelf `connectedEssay`). Used for ThreadLines on homepage.
- **Python** (Build 2): Runtime engine scoring RawSources against essays using domain matching, tag overlap, and text similarity. Used for the intake/triage pipeline.

Different engines, different jobs. Both are needed.
