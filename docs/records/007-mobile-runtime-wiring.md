# 007: Mobile runtime wiring

Status: implemented; provider rollout pending (2026-07-18)

## Goal

Replace the mobile chat surface's remaining manual or prompt-only affordances
with discoverable runtime contracts. The phone should learn what the connected
CommonPlace deployment can actually do, carry an explicit capability selection
through assistant-ui into hosted ACP, and explain exactly why push or catalog
features are unavailable.

## Decisions

- `GET /capabilities` remains the authenticated, secret-free bootstrap. It may
  advertise public URLs and an Expo project id, but never provider credentials.
- `GET /mobile/catalog` is the authenticated plugin/skill catalog. Its durable
  source is CommonPlace `plugin` and `skill` items; deployment JSON can add
  entries while an external registry sync is being established.
- A composer catalog selection is stored in assistant-ui `runConfig.custom`,
  sent in the hosted chat request, validated by the Console route, and rendered
  into the ACP prompt with the original user text retained as `displayText`.
- Push token acquisition and push token registration are separate gates. The
  app needs a public Expo project id and a configured registration URL before it
  asks Expo for a token. APNs/FCM credentials remain provider-managed.
- The deployed Console stream is the product chat route. Mobile may use the
  build-time URL or a URL advertised by the connected CommonPlace node; it does
  not fall back to a different agent path.

## Acceptance criteria

- A connected node returns authenticated capability and catalog documents; an
  unauthenticated request is refused.
- Plugins and skills in the catalog are selectable by id and name. Empty or
  unavailable catalogs render locked, named states rather than prompt seeds.
- Web search is selectable only when the node advertises it.
- The assistant-ui adapter forwards the selected capability to the Console
  stream request, and the Console preserves the original display text.
- Chat resolves from a saved URL, a connected-node advertised URL, or the
  deployed v2 build default, in that order.
- Push registration reports simulator, permission, project-id, relay, and
  success states distinctly. Token rotation uses the same configured relay.
- Expo/EAS profiles and environment templates contain no secrets. Native iOS
  retains its `aps-environment` entitlement.
- Focused Rust tests, mobile typecheck/tests/lint, Console tests/typecheck, Expo
  config inspection, and an unsigned simulator build all pass or report an
  existing baseline failure precisely.

## Provider gate

The repository can be made provider-ready without credentials. Creating or
uploading APNs/FCM credentials requires an authenticated Expo/EAS account. The
current machine reported `Not logged in`; completion of that external gate must
be verified after authentication rather than represented as code completion.

The local Railway CLI is linked to a different project, so this work does not
write deployment variables to that project. After merge, the CommonPlace API
and Console services must be selected explicitly before applying the variables
documented in their environment templates.

The push-registration relay is now a discovered/configurable contract, but no
matching hosted relay route exists in the checked source. A real relay must be
deployed and advertised through `COMMONPLACE_PUSH_REGISTRATION_URL` before a
physical-device registration can succeed.

## Validation

- The CommonPlace API mobile wiring acceptance test passes.
- Mobile TypeScript, focused tests, and changed-file lint pass.
- Console TypeScript, focused tests, and changed-file lint pass.
- Expo public config resolves the build-provided EAS project id while retaining
  the existing share-intent plugin configuration.
- `pod install` restored Expo SQLite's vendored native source and produced no
  tracked repository changes.
- The unsigned simulator build reaches the dependency build phase, then the
  Swift compiler crashes while compiling the `ExpoModulesJSI` xcframework for
  the x86_64 simulator. Repeating with one active architecture, constrained
  concurrency, and a clean package-derived cache produces the same dependency
  crash. This is an existing native toolchain/dependency gate rather than a
  TypeScript source failure and needs separate Expo/Xcode remediation.
