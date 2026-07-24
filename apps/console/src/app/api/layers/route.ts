// SOURCING: none — pure logic, no upstream component applies
import { NextResponse } from 'next/server';
import { NATIVE_LAYER_DESCRIPTORS } from '@commonplace/multiplex-layers';

/**
 * Same-origin layer registry for the Console picker (SPEC-MULTIPLEX-LAYERS ML4).
 * Mirrors rustyred-thg-core::LayerRegistry::with_native_defaults via the shared
 * package constant. Replace with a live commonplace-api export when available
 * so an eighth Rust registration appears without a frontend edit.
 */
export async function GET() {
  return NextResponse.json({ layers: NATIVE_LAYER_DESCRIPTORS });
}
