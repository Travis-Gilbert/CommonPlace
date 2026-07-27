# SPEC-COMMONPLACE-FORK-1.0: FK9 embed handoff

Date: 2026-07-27

Status: local fork implemented and independently verified. Live fork-server,
tenant, and rendered-browser acceptance remain open.

## Exact repositories

| Purpose | Path | Revision and state |
|---|---|---|
| Read-only upstream | `/Volumes/SSD Samsung/commonplace-sources/anythingllm-embed` | Detached at `7e5c6afc0266a536dfeeae10b73747461b31ca44`; clean; fetch URL retained for provenance; push URL is `DISABLED`. |
| Independent hard fork | `/Volumes/SSD Samsung/commonplace-worktrees/commonplace-embed-fork` | Clean local `main` at `779f262dacb581c004c6e33d237f5d43dc67711d`; no remotes and no branch tracking. |
| CommonPlace handoff | `/Volumes/SSD Samsung/commonplace-worktrees/commonplace-fork-1-0/apps/console/docs/plans/fork/embed-handoff.md` | Documentation only. This CommonPlace worktree was not committed by FK9. |

No remote repository was created. No fetch, push, issue, pull request, release,
or other external GitHub mutation was performed.

## Inventory-before-copy receipt

`embed-inventory.md` was written and mechanically checked before the
destination repository was created:

| Verdict | Files | LF line bytes |
|---|---:|---:|
| port | 59 | 6,584 |
| service | 0 | 0 |
| cut | 3 | 44 |
| **Total** | **62** | **6,628** |

The check found all 62 upstream tracked paths, no missing path, no extra path,
no duplicate path, and no incorrect line count. The service count is zero
because the upstream embed repository contains only the browser widget.

The source import used only the 59 port paths. These cut files never entered
the independent repository:

- `src/assets/anything-llm-dark.png`
- `src/assets/anything-llm-icon.svg`
- `src/components/Sponsor/index.jsx`

## Fork boundary

The fork is a fresh local Git repository with one root commit:

```text
779f262dacb581c004c6e33d237f5d43dc67711d
feat(widget): create independent embed fork
```

There is no `origin`, no other remote, no upstream branch configuration, and
no parent-repository publish script. The package is private and named
`@commonplace/embed-widget`. Its build artifacts are:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `dist/commonplace-chat-widget.js` | 3,236,327 | `d0b89bfe8ad3b7ab42780009d5023309dcf7d86274920604c88bf89d604341bf` |
| `dist/commonplace-chat-widget.min.js` | 662,541 | `9021c474216a8a7eec2728d1a2e11e851f9d577edf2fbc472600a144080468fb` |
| `dist/commonplace-chat-widget.min.css` | 14,026 | `74e99d2f4e459ba9054f2994129b063978576344805ab8fc330c393ac4623d0e` |

`dist` is ignored and not committed. A consumer must build the named commit or
publish the resulting artifacts through a separately authorized release
process.

## License and provenance

The fork's `LICENSE` is byte-for-byte identical to the upstream MIT license:

```text
SHA-256: 782d2dc18a1ed9028ca992520f42b2e0b6187807da0d14455b8ae608e2e5692e
```

`NOTICE.md` records the upstream repository and exact source commit. The
README keeps the same provenance and describes the independent boundary.

## Server URL and authentication

New integrations use:

- `data-server-url` for the forked embed API
- `data-auth-token` for an optional public embed token
- `data-auth-header` for an optional custom header name
- `data-auth-scheme` for `Bearer` or a custom prefix
- `data-credentials` for `omit`, `same-origin`, or `include`

`data-base-api-url` remains a migration alias. Configuration rejects non-HTTP
schemes, URL credentials, queries, fragments, invalid header names, line
breaks in auth values, and unsupported credential modes. Path segments are
URL encoded.

The same policy is applied to all three widget requests:

```text
GET    {serverUrl}/{embedId}/{sessionId}
DELETE {serverUrl}/{embedId}/{sessionId}
POST   {serverUrl}/{embedId}/stream-chat
```

The SSE POST carries `Content-Type: application/json` and
`Accept: text/event-stream`. The history and reset requests use
`Accept: application/json`.

An auth token in a script attribute is visible to visitors. The README
therefore limits this field to a public, narrow, embed-scoped credential and
explicitly refuses administrator keys, service credentials, and long-lived
private tokens.

## Sources and citations

The response path retains the `sources` array through history mapping,
streaming chunks, and final message state. The UI renders sources in both
historical and streamed assistant responses.

The normalizer accepts string sources and common direct or nested metadata
keys. It deduplicates repeated citations. HTTP and HTTPS URLs render as safe
new-tab links with `noopener noreferrer`. Other schemes and invalid URLs
render as plain labels. Raw source text and context snippets are not rendered.

The default upstream logo and sponsor surface were replaced with a neutral
Phosphor chat mark and CommonPlace naming. The fork retains optional
consumer-supplied assistant and brand images.

## Verification receipts

### Install and independent gate

```text
yarn install --frozen-lockfile
PASS, Yarn 1.22.22, existing lockfile retained

yarn verify
PASS
```

`yarn verify` performed:

- translation schema verification for 17 non-English locale registrations
- 8 Node tests with 8 passed, 0 failed, and 0 skipped
- Vite 5.0.12 production build with 2,803 modules transformed
- independent CSS minification and JavaScript minification

The tests prove:

- canonical and legacy server URL configuration
- bearer, custom-header, raw-token, and cookie credential modes
- invalid URL and header refusal
- encoded embed and session path segments
- auth propagation to history GET, reset DELETE, and SSE POST
- source retention from history and streamed events
- direct and nested citation normalization
- citation deduplication
- safe linked and plain citation markup
- refusal to emit a `javascript:` citation link

The build emitted one maintenance warning that the pinned Browserslist
`caniuse-lite` data is outdated. It did not fail the build. Dependency refresh
was not part of this pinned-fork slice.

### Local authenticated contract probe

A temporary uncommitted Node mock server was run on port 3090 and deleted
after the probe. The built widget assets were served from port 3080.

Observed:

- request without auth: HTTP 401
- history GET with `Authorization: Bearer development-public-token`: HTTP 200
  with one source-bearing assistant message
- stream POST with the same header: HTTP 200 SSE with two chunks and a final
  source-bearing response
- built JavaScript: HTTP 200
- built CSS: HTTP 200

This proves the local request and payload contract against a controlled mock.
It is not evidence that a CommonPlace or AnythingLLM server implements the
contract.

### Browser validation

The in-app browser integration was selected first as required by the frontend
test workflow. Runtime discovery returned no available browser backend. No
fallback browser dependency was installed.

There is therefore no screenshot, browser-console receipt, launcher click,
typed prompt, or rendered live-SSE interaction receipt. The actual citation
component was instead loaded through Vite and checked with React static
rendering in the independent test suite.

## Remaining acceptance gaps

1. Implement or identify the forked server endpoints at the configured URL.
   The pinned upstream AnythingLLM embed server intentionally filters sources
   from history and sends empty source arrays during live streaming, so it
   cannot satisfy this fork's citation contract unchanged.
2. Define issuance, scope, expiry, rotation, revocation, rate limiting, CORS,
   and CSRF behavior for the public embed credential or secure cookie.
3. Prove that one embed credential cannot read, reset, or stream another
   tenant, workspace, embed, or session.
4. Run history, reset, retrieval, streaming, and citation tests against the
   real deployed forked server. Repeat unauthenticated, invalid-token,
   expired-token, and origin-refusal cases.
5. Run the browser flow against built deployed assets and the real server.
   Capture page identity, nonblank state, console health, responsive
   screenshots, launcher behavior, prompt submission, final citation, link
   safety, and reset behavior.
6. Authorize a separate repository host and artifact release path if this
   local-only hard fork is to be published. No remote or deployment was
   created in this slice.

FK9 should remain partial until gaps 1 through 5 have live evidence. The local
hard-fork, license, independent build, auth configuration, and test boundary
are complete at the commit above.
