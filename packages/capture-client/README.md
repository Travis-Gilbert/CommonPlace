# CommonPlace Capture Client

`@commonplace/capture-client` is the versioned, dependency-free client boundary
for the CommonPlace Capture 2.0 envelope.

The host supplies storage and transport adapters. Queue rows contain capture
content and retry metadata, but never API credentials. The queue:

- persists an envelope before attempting delivery;
- keeps retryable failures across process and browser restarts;
- drains in insertion order with exponential backoff whose growth is bounded;
- uses the envelope `client_id` as the stable idempotency key; and
- normalizes legacy full-route settings to the CommonPlace API base.

```bash
pnpm --filter @commonplace/capture-client test
```
