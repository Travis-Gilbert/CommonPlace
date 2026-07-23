// SOURCING: none. Material vocabulary for SPEC-MATERIAL-REGISTER-1.0 named choice 5.

/** Epistemic texture states. Only Deterministic is reachable until FORME D4. */
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
  Discharged: { state: 'Discharged', shader: 'paper-texture', amplitude: 0.2, reachable: false },
  Undischarged: { state: 'Undischarged', shader: 'dithering', amplitude: 0.45, reachable: false },
  Refused: { state: 'Refused', shader: 'fluted-glass', amplitude: 0.7, reachable: false },
};

export function resolveMaterial(state: MaterialState = 'Deterministic'): MaterialDescriptor {
  const entry = MATERIAL_MAP[state];
  return entry.reachable ? entry : MATERIAL_MAP.Deterministic;
}
