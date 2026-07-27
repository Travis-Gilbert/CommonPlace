// SOURCING: none. Material vocabulary for SPEC-MATERIAL-REGISTER-1.0 named choice 5.

/** Epistemic texture states. Deterministic, Discharged (paper writing), and
 *  Refused (endpoint refuse) are reachable; Undischarged stays FORME-gated. */
export type MaterialState = 'Deterministic' | 'Discharged' | 'Undischarged' | 'Refused';

export type MaterialDescriptor = {
  state: MaterialState;
  /** Paper fragment id or 'none'. */
  shader: 'none' | 'dot-grid' | 'dithering' | 'paper-texture' | 'fluted-glass';
  /** Amplitude hint for static CSS fallback when WebGL is budgeted out. */
  amplitude: 0 | 0.2 | 0.45 | 0.7;
  reachable: boolean;
};

export const MATERIAL_MAP: Record<MaterialState, MaterialDescriptor> = {
  Deterministic: { state: 'Deterministic', shader: 'dot-grid', amplitude: 0, reachable: true },
  // Reachable for paper writing surfaces (composer idle/focused). FORME object
  // discharge still does not invent Undischarged on graph nodes.
  Discharged: { state: 'Discharged', shader: 'paper-texture', amplitude: 0.2, reachable: true },
  Undischarged: { state: 'Undischarged', shader: 'dithering', amplitude: 0.45, reachable: false },
  // Reachable for composer endpoint-refused (SPEC-CONSOLE-INFORMATION-ARCHITECTURE D6).
  Refused: { state: 'Refused', shader: 'fluted-glass', amplitude: 0.7, reachable: true },
};

export function resolveMaterial(state: MaterialState = 'Deterministic'): MaterialDescriptor {
  const entry = MATERIAL_MAP[state];
  return entry.reachable ? entry : MATERIAL_MAP.Deterministic;
}
