/**
 * TypeScript mirror of `rustyred-thg-reconstruct-fact` types.
 *
 * These are the frontend-facing shapes for reconstructed facts flowing through
 * the CommonPlace GraphQL API. They track the Rust serde renames exactly so
 * tags, extra fields, and GraphQL JSON fields match.
 *
 * SOURCE OF TRUTH (keep in sync if the Rust changes):
 *   Theorem/rustyredcore_THG/crates/rustyred-thg-reconstruct-fact/src/lib.rs
 *   Theorem/rustyredcore_THG/crates/rustyred-thg-reconstruct-fact/src/confidence.rs
 */

// ── Modality ────────────────────────────────────────────────────────────────

/** Wire values match `Modality::as_str()` — serde `rename_all = "snake_case"`. */
export const MODALITIES = ["binary", "data", "design", "procedural"] as const;
export type Modality = (typeof MODALITIES)[number];

export function isModality(value: unknown): value is Modality {
  return MODALITIES.includes(value as Modality);
}

// ── FactEvidence ────────────────────────────────────────────────────────────

/** Wire values match `FactEvidence::kind_str()`. */
export const EVIDENCE_KINDS = ["oracle", "inference", "heuristic", "manual"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** serde `tag = "kind"`, `rename_all = "snake_case"`. */
export type FactEvidence =
  | { kind: "oracle"; oracle_id: string; oracle_version?: string | null }
  | { kind: "inference"; rule: string; premises: string[] }
  | { kind: "heuristic"; method: string }
  | { kind: "manual"; author: string };

export function evidenceKind(evidence: FactEvidence): EvidenceKind {
  return evidence.kind;
}

// ── Provenance ──────────────────────────────────────────────────────────────

export interface ProvenanceChain {
  source_id: string;
  derivation_steps?: string[];
  content_hash?: string | null;
}

// ── Confidence ──────────────────────────────────────────────────────────────

/** serde `rename_all = "snake_case"`. */
export type VerificationOutcome = "success" | "failure";

export interface VerificationReceipt {
  id: string;
  outcome: VerificationOutcome;
  weight?: number;
  verifier_id?: string | null;
}

/**
 * Bayesian confidence as a Beta posterior.
 * `posterior` carries `alpha` and `beta` from `BetaBernoulli`.
 * When consumed from GraphQL this arrives as a JSON object in the Item `extra` field.
 */
export interface FactConfidence {
  posterior: { alpha: number; beta: number };
  last_receipt_id?: string | null;
  verification_count?: number;
}

// ── ReconstructedFact ──────────────────────────────────────────────────────

/**
 * One reconstructed fact, carrying its modality, evidence, and Bayesian confidence.
 *
 * On the GraphQL wire this arrives as a CommonPlace `Item` with:
 * - `kind`: "Scene" (the renderable fact surface)
 * - `classification`: the modality string
 * - `tags`: ["reconstructed", modality, evidence_kind, ...]
 * - `extra`: JSON map with confidence_mean, verification_count, evidence_kind, provenance
 */
export interface ReconstructedFactWire {
  modality: Modality;
  fact_type: string;
  payload: unknown;
  evidence: FactEvidence;
  confidence: FactConfidence;
  provenance: ProvenanceChain;
}

/**
 * Extraction helpers — pull reconstructed-fact metadata out of a
 * CommonPlaceGraphqlItem's `extra` field.
 */

export interface ReconstructedExtra {
  modality?: string;
  fact_type?: string;
  confidence_mean?: number;
  verification_count?: number;
  evidence_kind?: EvidenceKind;
  provenance?: {
    source_id?: string;
    derivation_steps?: string[];
    content_hash?: string | null;
  };
}

/**
 * Parse `item.extra` (which arrives as a JSON map) into typed reconstructed metadata.
 * Returns `null` when the item wasn't produced by a reconstructor.
 */
export function parseReconstructedExtra(
  extra: unknown,
): ReconstructedExtra | null {
  if (extra === null || extra === undefined) return null;
  // extra arrives as a Record<string, unknown> from GraphQL JSON scalar
  const e = extra as Record<string, unknown>;
  // The reconstructor always stamps "modality" into extra
  if (typeof e.modality !== "string" || !isModality(e.modality)) return null;
  return {
    modality: e.modality as Modality,
    fact_type: typeof e.fact_type === "string" ? e.fact_type : undefined,
    confidence_mean:
      typeof e.confidence_mean === "number" ? e.confidence_mean : undefined,
    verification_count:
      typeof e.verification_count === "number"
        ? e.verification_count
        : undefined,
    evidence_kind: EVIDENCE_KINDS.includes(e.evidence_kind as EvidenceKind)
      ? (e.evidence_kind as EvidenceKind)
      : undefined,
    provenance:
      typeof e.provenance === "object" && e.provenance !== null
        ? (e.provenance as ReconstructedExtra["provenance"])
        : undefined,
  };
}

/** Items tagged "reconstructed". This is the tag gate. */
export const RECONSTRUCTED_TAG = "reconstructed";
