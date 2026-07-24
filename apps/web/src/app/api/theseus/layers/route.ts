// SOURCING: none — pure logic, no upstream component applies
import { NextResponse } from 'next/server';
import { NATIVE_LAYER_DESCRIPTORS } from '@commonplace/multiplex-layers';

/**
 * Legacy path alias for the Mosaic explorer. Same payload as Console
 * `/api/layers`: mirror of LayerRegistry::with_native_defaults.
 */
export async function GET() {
  return NextResponse.json({ layers: NATIVE_LAYER_DESCRIPTORS });
}
