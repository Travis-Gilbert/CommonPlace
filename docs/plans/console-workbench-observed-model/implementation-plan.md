# Console workbench and observed model frontend

Plan id: `plan:ae246b9d758e7981`

Spec: `HANDOFF-CONSOLE-WORKBENCH-AND-OBSERVED-MODEL`

Branches: CommonPlace `Travis-Gilbert/console-observed-model`, Theorem `Travis-Gilbert/console-observed-model`

## Status (leads with not done)

* Live end to end pin, proposal publish, and Why against an admitted tenant with DATAWAVE events: not verified in this session.
* Dockview as named in the handoff: not done. D9 uses the existing island, region, and view-instance shell (dockview is a separate assumed handoff).
* Code for D1 through D9 (except dockview) is implemented on the branches above. Unit tests for the observed projection and console contracts pass.

## Locked choices

* Scope is the Indexer `topicId`.
* Observed evidence is read only. Pinning promotes it to declared metadata.
* The frame uses the existing island, region, and view instance shell.
* Why uses the existing `WhyTracePanel`.
* Diagram rendering uses React Flow.
* Shipped surfaces contain no mock observed model.

## Deliverable checklist

1. D1 contracts package: complete.
   * Spec backreference: D1 contracts package.
   * Oracle class: deterministic unit tests.
   * Implementation mode: live package code.
   * Evidence class: Vitest.
   * Substitution allowed: false.
   * Live oracle required: false.
2. D2 server harness and API: complete.
   * Spec backreference: Server harness and API.
   * Oracle class: GraphQL contract and same origin route behavior.
   * Implementation mode: live route code.
   * Evidence class: type checking plus browser error state.
   * Substitution allowed: false.
   * Live oracle required: true.
3. D3 pin client: complete.
   * Spec backreference: D3 pin client.
   * Oracle class: live GraphQL mutation receipt.
   * Implementation mode: live client and server code.
   * Evidence class: static contract verification.
   * Substitution allowed: false.
   * Live oracle required: true.
4. D5 Model surface: complete.
   * Spec backreference: D5 Model surface.
   * Oracle class: desktop browser interaction.
   * Implementation mode: live React surface.
   * Evidence class: Playwright browser verification.
   * Substitution allowed: false.
   * Live oracle required: false.
5. D6 inspector: complete for all evidence returned by the backend.
   * Spec backreference: D6 Inspector.
   * Oracle class: selected observed field or relation.
   * Implementation mode: live side panel.
   * Evidence class: static branch verification.
   * Substitution allowed: false.
   * Live oracle required: true.
6. D7 Why: complete.
   * Spec backreference: D7 Why.
   * Oracle class: selected declared field with a provenance node.
   * Implementation mode: existing Why trace integration.
   * Evidence class: static component verification.
   * Substitution allowed: false.
   * Live oracle required: true.
7. D8 proposal card: complete.
   * Spec backreference: D8 Proposal card.
   * Oracle class: live proposal, decline, and accept mutations.
   * Implementation mode: live review card.
   * Evidence class: static contract verification.
   * Substitution allowed: false.
   * Live oracle required: true.
8. D9 frame and registry: complete.
   * Spec backreference: D9 Frame and registry.
   * Oracle class: routed seeded surface.
   * Implementation mode: live workspace shell.
   * Evidence class: Playwright at `/models`.
   * Substitution allowed: false.
   * Live oracle required: false.

## Remaining live evidence

The local browser had no admitted identity, so the model route correctly rendered an empty observed model with `principal_resolution=unauthenticated`. Pin, unpin, proposal acceptance, and Why traces still require a live admitted tenant and observed DATAWAVE events.

The current backend projection does not return field level event ids, source references, or route decisions. The inspector shows the model source catalog and explicit absent states until those values are added to the GraphQL payload.
