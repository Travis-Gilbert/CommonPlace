# RustyRed update channel

CommonPlace consumes RustyRed through a source pin and generated contracts,
not by hand-copying runtime code.

The current source pin lives at:

```txt
packages/rustyred-contracts/rustyred-source.json
```

`@commonplace/rustyred-contracts` exports that pin today. As the product
monorepo fills in, generated TypeScript/Rust contracts should be added to that
same package and regenerated from the pinned RustyRed commit.

## CommonPlace receiver

`.github/workflows/rustyred-source-update.yml` handles two triggers:

- `repository_dispatch` from RustyRed with event type `rustyred-updated` or
  `rustyred-main-updated`.
- Manual `workflow_dispatch` for backfills or testing.

The workflow updates the source pin, runs `npm run check`, and opens a PR like:

```txt
chore(rustyred): update source to <sha>
```

## RustyRed sender

Add this workflow to `Travis-Gilbert/RustyRed-Graph-Database` when you are ready
for automatic CommonPlace update PRs:

```yaml
name: Notify CommonPlace

on:
  push:
    branches:
      - main

jobs:
  dispatch-commonplace:
    runs-on: ubuntu-latest
    steps:
      - name: Dispatch CommonPlace update
        env:
          GH_TOKEN: ${{ secrets.COMMONPLACE_REPO_DISPATCH_TOKEN }}
          SHA: ${{ github.sha }}
          REF_NAME: ${{ github.ref_name }}
        run: |
          gh api \
            --method POST \
            -H "Accept: application/vnd.github+json" \
            /repos/Travis-Gilbert/CommonPlace/dispatches \
            -f event_type=rustyred-updated \
            -f client_payload[repository]=Travis-Gilbert/RustyRed-Graph-Database \
            -f client_payload[ref]="$REF_NAME" \
            -f client_payload[sha]="$SHA" \
            -f client_payload[updated_at]="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

The RustyRed repo needs a secret named `COMMONPLACE_REPO_DISPATCH_TOKEN`.
Use a fine-grained GitHub token or app token with access to `CommonPlace` and
permission to trigger repository dispatch events.

## Local commands

```bash
npm run check
npm run sync:rustyred -- --repo Travis-Gilbert/RustyRed-Graph-Database --ref main
npm run sync:rustyred -- --repo Travis-Gilbert/RustyRed-Graph-Database --sha <commit-sha>
```
