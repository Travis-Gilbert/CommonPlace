/**
 * Tests for reconstruction-types.ts and reconstruction-client.ts.
 *
 * Vitest, mirroring the Rust tests from reconstruct-fact/src/tests/.
 */

import { describe, it, expect } from "vitest";
import {
  MODALITIES,
  EVIDENCE_KINDS,
  isModality,
  parseReconstructedExtra,
  RECONSTRUCTED_TAG,
  type Modality,
  type FactEvidence,
  type ReconstructedExtra,
} from "./reconstruction-types";

// ── Modality ──────────────────────────────────────────────────────────────────

describe("Modality", () => {
  it("has all four modalities in the wire set", () => {
    expect(MODALITIES).toEqual(["binary", "data", "design", "procedural"]);
  });

  it("isModality accepts valid modalities", () => {
    expect(isModality("binary")).toBe(true);
    expect(isModality("data")).toBe(true);
    expect(isModality("design")).toBe(true);
    expect(isModality("procedural")).toBe(true);
  });

  it("isModality rejects invalid strings", () => {
    expect(isModality("other")).toBe(false);
    expect(isModality("")).toBe(false);
    expect(isModality(undefined)).toBe(false);
    expect(isModality(null)).toBe(false);
  });
});

// ── Evidence kinds ───────────────────────────────────────────────────────────

describe("EVIDENCE_KINDS", () => {
  it("has all four evidence kinds", () => {
    expect(EVIDENCE_KINDS).toEqual(["oracle", "inference", "heuristic", "manual"]);
  });
});

// ── parseReconstructedExtra ──────────────────────────────────────────────────

describe("parseReconstructedExtra", () => {
  it("returns null for null/undefined extra", () => {
    expect(parseReconstructedExtra(null)).toBeNull();
    expect(parseReconstructedExtra(undefined)).toBeNull();
  });

  it("returns null when modality is missing", () => {
    expect(parseReconstructedExtra({ fact_type: "Foo" })).toBeNull();
  });

  it("returns null when modality is not a known Modality", () => {
    expect(parseReconstructedExtra({ modality: "unknown" })).toBeNull();
  });

  it("parses a complete reconstructed extra from binary reconstructor", () => {
    const extra: Record<string, unknown> = {
      modality: "binary",
      fact_type: "FunctionSemanticSignature",
      confidence_mean: 0.833,
      verification_count: 6,
      evidence_kind: "oracle",
      provenance: {
        source_id: "ghidra:main:0x401000",
        derivation_steps: ["decompile", "semantic_lift", "sign"],
        content_hash: "abc123",
      },
    };

    const result = parseReconstructedExtra(extra);
    expect(result).not.toBeNull();
    expect(result!.modality).toBe("binary");
    expect(result!.fact_type).toBe("FunctionSemanticSignature");
    expect(result!.confidence_mean).toBe(0.833);
    expect(result!.verification_count).toBe(6);
    expect(result!.evidence_kind).toBe("oracle");
    expect(result!.provenance?.source_id).toBe("ghidra:main:0x401000");
    expect(result!.provenance?.derivation_steps).toEqual([
      "decompile",
      "semantic_lift",
      "sign",
    ]);
  });

  it("parses a minimal extra (modality only)", () => {
    const result = parseReconstructedExtra({ modality: "procedural" });
    expect(result).not.toBeNull();
    expect(result!.modality).toBe("procedural");
    expect(result!.fact_type).toBeUndefined();
    expect(result!.confidence_mean).toBeUndefined();
    expect(result!.evidence_kind).toBeUndefined();
  });

  it("parses design modality with heuristic evidence", () => {
    const extra: Record<string, unknown> = {
      modality: "design",
      fact_type: "DesignFinding",
      confidence_mean: 0.45,
      verification_count: 2,
      evidence_kind: "heuristic",
    };

    const result = parseReconstructedExtra(extra);
    expect(result).not.toBeNull();
    expect(result!.modality).toBe("design");
    expect(result!.confidence_mean).toBe(0.45);
    expect(result!.evidence_kind).toBe("heuristic");
  });

  it("rejects invalid evidence_kind", () => {
    const extra: Record<string, unknown> = {
      modality: "binary",
      evidence_kind: "not-a-kind",
    };
    const result = parseReconstructedExtra(extra);
    expect(result).not.toBeNull();
    // evidence_kind should be undefined because it didn't pass the guard
    expect(result!.evidence_kind).toBeUndefined();
  });

  it("handles extra with no provenance", () => {
    const result = parseReconstructedExtra({ modality: "data" });
    expect(result).not.toBeNull();
    expect(result!.provenance).toBeUndefined();
  });
});

// ── RECONSTRUCTED_TAG ────────────────────────────────────────────────────────

describe("RECONSTRUCTED_TAG", () => {
  it("is the string 'reconstructed'", () => {
    expect(RECONSTRUCTED_TAG).toBe("reconstructed");
  });
});

// ── Wire shape roundtrip: FactEvidence ────────────────────────────────────────

describe("FactEvidence tagged union", () => {
  it("oracle evidence has kind='oracle'", () => {
    const e: FactEvidence = {
      kind: "oracle",
      oracle_id: "ghidra",
    };
    expect(e.kind).toBe("oracle");
    expect(e.oracle_id).toBe("ghidra");
  });

  it("inference evidence has kind='inference'", () => {
    const e: FactEvidence = {
      kind: "inference",
      rule: "dedup",
      premises: ["a", "b"],
    };
    expect(e.kind).toBe("inference");
    expect(e.rule).toBe("dedup");
  });

  it("heuristic evidence has kind='heuristic'", () => {
    const e: FactEvidence = { kind: "heuristic", method: "pattern" };
    expect(e.kind).toBe("heuristic");
  });

  it("manual evidence has kind='manual'", () => {
    const e: FactEvidence = { kind: "manual", author: "alice" };
    expect(e.kind).toBe("manual");
  });
});
