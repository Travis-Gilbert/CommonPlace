# CommonPlace Capture Contract

The canonical wire contract is Capture 2.0 in
`Travis-Gilbert/Theorem/docs/plans/SPEC-THEOREM-CAPTURE-2.0.md`. This app
consumes the versioned `commonplace-capture/v1` boundary from
`@commonplace/capture-client`.

The clipper persists each envelope before its first network attempt, sends it
to `/ingest/capture`, and retains retryable failures in browser-local storage.
API credentials are read at delivery time and are never copied into queue rows.
