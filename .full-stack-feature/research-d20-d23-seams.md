# D20–D23 substrate seam inventory

**Date:** 2026-08-08  
**Plan task:** `fabric-seam-inventory`  
**Goal:** `goal:aa1c8c6380701610`

| ARD | Seam searched | Present? | File refs | Disposition |
|---|---|---|---|---|
| D20 Sweep | `sweep` in `rustyred-thg-programmable-graph` | **absent** | no matches | **blocker:** no ChainForge sweep primitive in programmable graph |
| D21 Expansion ghosts | Compound `expand_node` only | **partial** | MCP `expand_node`; ProgramView Compound expand | Compound ≠ sweep expansion; **blocker** for sweep ghosts |
| D22 Fingerprint | affordance fingerprint fn | **absent** in program UI/MCP gallery | unrelated web/MCP fingerprints only | **blocker:** no affordance fingerprint inspector contract on program catalog |
| D23 Cache/RAM | RunRail / StatusPanel cache keys | **absent** as operator surface | server graph cache exists elsewhere | **blocker:** no RAM-pressure / dual-key debug UI API exposed to console |

**Rule:** no fake ChainForge UI in console alone.
